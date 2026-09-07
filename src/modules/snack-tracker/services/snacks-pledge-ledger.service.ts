import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JiraClientService } from '../../jira/jira-client.service';
import {
  buildLedgerDescription,
  netDebtors,
  parseLedgerRecords,
  type OpenDebtor,
  type SnacksPledgeRecord,
} from '../snacks-ledger-adf';

export type { OpenDebtor, SnacksPledgeRecord } from '../snacks-ledger-adf';

const DEFAULT_JIRA_ISSUE = 'KAN-8438';

@Injectable()
export class SnacksPledgeLedgerService {
  private readonly issueKey: string;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly jiraClientService: JiraClientService,
    private readonly configService: ConfigService,
  ) {
    this.issueKey =
      this.configService.get<string>('BAKAR_SNACKS_JIRA_ISSUE') ??
      DEFAULT_JIRA_ISSUE;
  }

  async recordSnacksPledge(record: SnacksPledgeRecord): Promise<boolean> {
    return this.mutate((records) => {
      if (records.some((existing) => existing.messageId === record.messageId))
        return { next: records, result: false };
      return { next: [...records, record], result: true };
    });
  }

  async settleUser(userId: string): Promise<number> {
    return this.mutate((records) => {
      const next = records.filter((record) => record.userId !== userId);
      return { next, result: records.length - next.length };
    });
  }

  async listOpenDebtors(): Promise<OpenDebtor[]> {
    const description = await this.jiraClientService.getIssueDescription(
      this.issueKey,
    );
    return netDebtors(parseLedgerRecords(description));
  }

  /**
   * Serialize every read-modify-write against the Jira description so concurrent
   * Slack messages can't clobber each other's edit. Skips the write when the
   * mutation is a no-op to avoid empty entries in the ticket's audit history.
   */
  private mutate<T>(
    apply: (records: SnacksPledgeRecord[]) => {
      next: SnacksPledgeRecord[];
      result: T;
    },
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const description = await this.jiraClientService.getIssueDescription(
        this.issueKey,
      );
      const records = parseLedgerRecords(description);
      const { next, result } = apply(records);
      if (JSON.stringify(next) !== JSON.stringify(records))
        await this.jiraClientService.setIssueDescription(
          this.issueKey,
          buildLedgerDescription(next),
        );
      return result;
    };
    const chained = this.writeChain.then(run, run);
    this.writeChain = chained.catch(() => undefined);
    return chained;
  }
}
