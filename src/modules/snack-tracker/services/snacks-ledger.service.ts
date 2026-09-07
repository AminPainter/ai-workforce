import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000;
const PLEDGES_KEY = 'bakar:snacksPledges';
const FULFILLMENTS_KEY = 'bakar:snacksFulfillments';

export interface SnacksPledgeRecord {
  messageId: string;
  userId: string;
  userName: string;
  fullName: string;
  text: string;
  pledgedAt: string;
}

export interface SnacksFulfillmentRecord {
  messageId: string;
  fulfilledByUserId?: string;
  fulfilledAt: string;
}

export interface RecordSnacksPledgeResult {
  isFreshlyRecorded: boolean;
}

export interface FulfillPledgeResult {
  found: boolean;
  alreadyFulfilled: boolean;
  notOwner: boolean;
  record?: SnacksPledgeRecord;
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
    const isFreshlyRecorded = await this.store.setIfNotExists(
      seenKey,
      '1',
      ONE_YEAR_IN_MS,
    );
    if (!isFreshlyRecorded) return { isFreshlyRecorded: false };

    try {
      await this.store.appendToList(PLEDGES_KEY, record, {
        ttlMs: ONE_YEAR_IN_MS,
      });
    } catch (error) {
      // Roll back the gate so a retry can re-append this pledge.
      await this.store.delete(seenKey);
      throw error;
    }
    return { isFreshlyRecorded: true };
  }

  async fulfillPledge(
    messageId: string,
    fulfilledByUserId?: string,
  ): Promise<FulfillPledgeResult> {
    const pledges = await this.store.getList<SnacksPledgeRecord>(PLEDGES_KEY);
    const record = pledges.find((pledge) => pledge.messageId === messageId);
    if (!record)
      return { found: false, alreadyFulfilled: false, notOwner: false };

    if (fulfilledByUserId !== undefined && record.userId !== fulfilledByUserId)
      return { found: true, alreadyFulfilled: false, notOwner: true, record };

    const fulfilledKey = `bakar:fulfilled:${messageId}`;
    const isFreshlyFulfilled = await this.store.setIfNotExists(
      fulfilledKey,
      '1',
      ONE_YEAR_IN_MS,
    );
    if (!isFreshlyFulfilled)
      return { found: true, alreadyFulfilled: true, notOwner: false, record };

    try {
      await this.store.appendToList(
        FULFILLMENTS_KEY,
        {
          messageId,
          fulfilledByUserId,
          fulfilledAt: new Date().toISOString(),
        } satisfies SnacksFulfillmentRecord,
        { ttlMs: ONE_YEAR_IN_MS },
      );
    } catch (error) {
      // Roll back the gate so a retry can re-record this fulfillment.
      await this.store.delete(fulfilledKey);
      throw error;
    }
    return { found: true, alreadyFulfilled: false, notOwner: false, record };
  }

  async listPledges(): Promise<SnacksPledgeRecord[]> {
    return this.store.getList<SnacksPledgeRecord>(PLEDGES_KEY);
  }

  async listOpenPledges(): Promise<SnacksPledgeRecord[]> {
    const [pledges, fulfillments] = await Promise.all([
      this.store.getList<SnacksPledgeRecord>(PLEDGES_KEY),
      this.store.getList<SnacksFulfillmentRecord>(FULFILLMENTS_KEY),
    ]);
    const fulfilledMessageIds = new Set(
      fulfillments.map((fulfillment) => fulfillment.messageId),
    );
    return pledges.filter(
      (pledge) => !fulfilledMessageIds.has(pledge.messageId),
    );
  }
}
