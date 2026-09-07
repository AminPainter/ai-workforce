import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WithLockOptions {
  /** How long the lock is held before Redis auto-expires it (ms). */
  ttlMs?: number;
  /** Delay between acquire attempts while the lock is contended (ms). */
  retryDelayMs?: number;
  /** Give up acquiring after this long and throw (ms). */
  maxWaitMs?: number;
}

@Injectable()
export class RedisLockService implements OnModuleInit {
  private readonly logger = new Logger(RedisLockService.name);
  private store!: import('@chat-adapter/state-redis').RedisStateAdapter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const { createRedisState } = await import('@chat-adapter/state-redis');
    this.store = createRedisState({
      url: this.configService.getOrThrow<string>('REDIS_URL'),
      keyPrefix: 'locks',
    });
    await this.store.connect();
  }

  /**
   * Run `fn` while holding a Redis lock on `key`, blocking (with retry) until
   * the lock is free or `maxWaitMs` elapses. The lock auto-expires after
   * `ttlMs` so a crashed holder can't deadlock the key.
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: WithLockOptions = {},
  ): Promise<T> {
    const { ttlMs = 30_000, retryDelayMs = 100, maxWaitMs = 15_000 } = options;
    const deadline = Date.now() + maxWaitMs;

    let lock = await this.store.acquireLock(key, ttlMs);
    while (!lock) {
      if (Date.now() >= deadline)
        throw new Error(`Timed out acquiring redis lock "${key}"`);
      await sleep(retryDelayMs);
      lock = await this.store.acquireLock(key, ttlMs);
    }

    try {
      return await fn();
    } finally {
      await this.store.releaseLock(lock);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
