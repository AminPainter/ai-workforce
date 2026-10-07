import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LeaveKind, LeavePortion } from '../constants/leave-kinds';

const ONE_YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000;
const AUDIT_RETENTION_MS = 3 * ONE_YEAR_IN_MS;
const PENDING_CLARIFICATION_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const AUDIT_KEY = 'audit';

export interface EmployeeEntity {
  entityId: number;
  razorpayxEmail: string;
  employeeId: string | number | null;
}

export interface RecordedEntry {
  email: string;
  date: string;
  kind: LeaveKind;
  portion: LeavePortion;
}

export interface PendingClarification {
  messageId: string;
  text: string;
  postedAt: string;
  question: string;
}

export interface LeaveAuditEntry {
  at: string;
  mode: 'live' | 'shadow';
  sourceMessageId: string;
  actorSlackUserId: string;
  subjectEmail: string;
  entityId: number | null;
  date: string;
  operation: 'mark' | 'revert';
  request: Record<string, unknown> | null;
  outcome: string;
  detail?: string;
}

@Injectable()
export class LeaveLedgerService implements OnModuleInit {
  private store!: import('@chat-adapter/state-redis').RedisStateAdapter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const { createRedisState } = await import('@chat-adapter/state-redis');
    this.store = createRedisState({
      url: this.configService.getOrThrow<string>('REDIS_URL'),
      keyPrefix: 'leaves',
    });
    await this.store.connect();
  }

  async markSeen(messageId: string): Promise<boolean> {
    return this.store.setIfNotExists(`seen:${messageId}`, '1', ONE_YEAR_IN_MS);
  }

  async unmarkSeen(messageId: string): Promise<void> {
    await this.store.delete(`seen:${messageId}`);
  }

  async isSeen(messageId: string): Promise<boolean> {
    return (await this.store.get(`seen:${messageId}`)) !== null;
  }

  async getEmployeeEntity(email: string): Promise<EmployeeEntity | null> {
    return this.store.get<EmployeeEntity>(`entity:${email.toLowerCase()}`);
  }

  async setEmployeeEntity(
    email: string,
    entity: EmployeeEntity,
  ): Promise<void> {
    await this.store.set(`entity:${email.toLowerCase()}`, entity);
  }

  async getRecordedEntries(messageId: string): Promise<RecordedEntry[]> {
    return (await this.store.get<RecordedEntry[]>(`source:${messageId}`)) ?? [];
  }

  async addRecordedEntries(
    messageId: string,
    entries: RecordedEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;
    const existing = await this.getRecordedEntries(messageId);
    const byKey = new Map(
      [...existing, ...entries].map((entry) => [
        `${entry.email}:${entry.date}`,
        entry,
      ]),
    );
    await this.store.set(
      `source:${messageId}`,
      [...byKey.values()],
      ONE_YEAR_IN_MS,
    );
  }

  async removeRecordedEntries(
    messageId: string,
    email: string,
    dates: string[],
  ): Promise<void> {
    const existing = await this.getRecordedEntries(messageId);
    const remaining = existing.filter(
      (entry) => entry.email !== email || !dates.includes(entry.date),
    );
    if (remaining.length === existing.length) return;
    await this.store.set(`source:${messageId}`, remaining, ONE_YEAR_IN_MS);
  }

  async getPendingClarification(
    threadId: string,
    userId: string,
  ): Promise<PendingClarification | null> {
    return this.store.get<PendingClarification>(
      `pending:${threadId}:${userId}`,
    );
  }

  async setPendingClarification(
    threadId: string,
    userId: string,
    pending: PendingClarification,
  ): Promise<void> {
    await this.store.set(
      `pending:${threadId}:${userId}`,
      pending,
      PENDING_CLARIFICATION_TTL_MS,
    );
  }

  async clearPendingClarification(
    threadId: string,
    userId: string,
  ): Promise<void> {
    await this.store.delete(`pending:${threadId}:${userId}`);
  }

  async appendAudit(entry: LeaveAuditEntry): Promise<void> {
    await this.store.appendToList(AUDIT_KEY, entry, {
      ttlMs: AUDIT_RETENTION_MS,
    });
  }
}
