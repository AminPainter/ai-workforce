import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';

const REDIS_PING_TIMEOUT_MS = 1000;

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    configService: ConfigService,
  ) {
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      enableOfflineQueue: false,
    });
  }

  isHealthy(key: string) {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.redis.ping();
      })
      .withTimeout(REDIS_PING_TIMEOUT_MS);
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
