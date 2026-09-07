import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000;
const PLEDGES_KEY = 'bakar:snacksPledges';

export interface SnacksPledgeRecord {
  messageId: string;
  userId: string;
  userName: string;
  fullName: string;
  text: string;
  pledgedAt: string;
}

export interface RecordSnacksPledgeResult {
  freshlyRecorded: boolean;
}

@Injectable()
export class SnacksLedgerService implements OnModuleInit {
  private store!: import('@chat-adapter/state-redis').RedisStateAdapter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const { createRedisState } = await import('@chat-adapter/state-redis');
    this.store = createRedisState({
      url: this.configService.getOrThrow<string>('REDIS_URL'),
      keyPrefix: 'snacks',
    });
    await this.store.connect();
  }

  async recordSnacksPledge(
    record: SnacksPledgeRecord,
  ): Promise<RecordSnacksPledgeResult> {
    const seenKey = `bakar:seen:${record.messageId}`;
    const freshlyRecorded = await this.store.setIfNotExists(
      seenKey,
      '1',
      ONE_YEAR_IN_MS,
    );
    if (!freshlyRecorded) return { freshlyRecorded: false };

    try {
      await this.store.appendToList(PLEDGES_KEY, record, {
        ttlMs: ONE_YEAR_IN_MS,
      });
    } catch (error) {
      // Roll back the gate so a retry can re-append this pledge.
      await this.store.delete(seenKey);
      throw error;
    }
    return { freshlyRecorded: true };
  }
}
