import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SNACKS_PLEDGES_KEY = 'bakar:snacksPledges';
const SETTLEMENTS_KEY = 'bakar:settlements';

export interface SnacksPledgeRow {
  messageId: string;
  userId: string;
  userName: string;
  fullName: string;
  text: string;
  threadId: string;
  pledgedAt: string;
}

export interface SettlementRow {
  userId: string;
  count: number;
  settledByUserId: string;
  settledAt: string;
}

export interface OpenDebtor {
  userId: string;
  userName: string;
  fullName: string;
  openCount: number;
  lastPledgedAt: string;
}

@Injectable()
export class SnacksPledgeLedgerService implements OnModuleInit {
  private readonly logger = new Logger(SnacksPledgeLedgerService.name);
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

  async recordSnacksPledge(row: SnacksPledgeRow): Promise<boolean> {
    const existing =
      await this.store.getList<SnacksPledgeRow>(SNACKS_PLEDGES_KEY);
    if (existing.some((pledge) => pledge.messageId === row.messageId))
      return false;
    await this.store.appendToList(SNACKS_PLEDGES_KEY, row);
    return true;
  }

  async listOpenDebtors(): Promise<OpenDebtor[]> {
    const [pledges, settlements] = await Promise.all([
      this.store.getList<SnacksPledgeRow>(SNACKS_PLEDGES_KEY),
      this.store.getList<SettlementRow>(SETTLEMENTS_KEY),
    ]);

    const settledByUser = new Map<string, number>();
    for (const settlement of settlements)
      settledByUser.set(
        settlement.userId,
        (settledByUser.get(settlement.userId) ?? 0) + settlement.count,
      );

    const byUser = new Map<string, OpenDebtor>();
    for (const pledge of pledges) {
      const current = byUser.get(pledge.userId);
      if (current) {
        current.openCount += 1;
        if (pledge.pledgedAt > current.lastPledgedAt)
          current.lastPledgedAt = pledge.pledgedAt;
      } else
        byUser.set(pledge.userId, {
          userId: pledge.userId,
          userName: pledge.userName,
          fullName: pledge.fullName,
          openCount: 1,
          lastPledgedAt: pledge.pledgedAt,
        });
    }

    const debtors: OpenDebtor[] = [];
    for (const debtor of byUser.values()) {
      debtor.openCount -= settledByUser.get(debtor.userId) ?? 0;
      if (debtor.openCount > 0) debtors.push(debtor);
    }
    return debtors.sort((a, b) => b.openCount - a.openCount);
  }

  async settleUser(userId: string, settledByUserId: string): Promise<number> {
    const debtor = (await this.listOpenDebtors()).find(
      (candidate) => candidate.userId === userId,
    );
    const count = debtor?.openCount ?? 0;
    if (count <= 0) return 0;
    await this.store.appendToList(SETTLEMENTS_KEY, {
      userId,
      count,
      settledByUserId,
      settledAt: new Date().toISOString(),
    } satisfies SettlementRow);
    return count;
  }
}
