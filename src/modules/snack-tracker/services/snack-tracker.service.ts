import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { SnacksPledgeLedgerService } from './snacks-pledge-ledger.service';
import { SNACKS_PLEDGE_CLASSIFIER } from '../agents/snacks-pledge-classifier.agent';
import { SNACK_COMMAND } from '../agents/snack-command.agent';
import type { SnacksPledgeClassification } from '../agents/snacks-pledge-classifier.schema';
import type { SnackCommand } from '../agents/snack-command.schema';

const CONFIRMATION_MESSAGE =
  'Hehe 😈 noted — snacks are officially pending on you.';

@Injectable()
export class SnackTrackerService {
  private readonly logger = new Logger(SnackTrackerService.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly snacksPledgeLedgerService: SnacksPledgeLedgerService,
    private readonly configService: ConfigService,
  ) {}

  async handlePotentialSnacksPledge(
    thread: import('chat').Thread,
    message: import('chat').Message,
  ): Promise<void> {
    if (message.author.isBot === true || message.author.isMe) return;
    const text = message.text?.trim();
    if (!text) return;

    let classification: SnacksPledgeClassification;
    try {
      const { output } = (await this.agentRegistry
        .get(SNACKS_PLEDGE_CLASSIFIER)
        .generate({ messages: [{ role: 'user', content: text }] })) as {
        output: SnacksPledgeClassification;
      };
      classification = output;
    } catch (error) {
      this.logger.error(`snacks-pledge classifier failed: ${error}`);
      return;
    }
    if (!classification.isSnacksPledge) return;

    const recorded = await this.snacksPledgeLedgerService.recordSnacksPledge({
      messageId: message.id,
      userId: message.author.userId,
      userName: message.author.userName,
      fullName: message.author.fullName,
      text,
      threadId: message.threadId,
      pledgedAt: new Date().toISOString(),
    });
    if (!recorded) return;

    this.logger.log(`snacks pledge recorded for ${message.author.fullName}`);
    await thread.post(CONFIRMATION_MESSAGE);
  }

  async handleCommand(
    thread: import('chat').Thread,
    message: import('chat').Message,
  ): Promise<void> {
    const text = message.text?.trim() ?? '';

    let command: SnackCommand;
    try {
      const { output } = (await this.agentRegistry
        .get(SNACK_COMMAND)
        .generate({ messages: [{ role: 'user', content: text }] })) as {
        output: SnackCommand;
      };
      command = output;
    } catch (error) {
      this.logger.error(`snack command parse failed: ${error}`);
      await thread.post('My snack brain glitched. Try `who owes snacks`.');
      return;
    }

    if (command.intent === 'list') {
      await thread.post(await this.buildDebtorSummary());
      return;
    }
    if (command.intent === 'settle') {
      await this.handleSettle(thread, message, command);
      return;
    }
    await thread.post(
      'I keep the snack tab here. Try `who owes snacks`, or `settle @person`.',
    );
  }

  private async handleSettle(
    thread: import('chat').Thread,
    message: import('chat').Message,
    command: SnackCommand,
  ): Promise<void> {
    const targets = this.resolveSettleTargets(message, command);
    if (targets.length === 0) {
      await thread.post('Who settled? Mention them, e.g. `settle @person`.');
      return;
    }

    const cleared: string[] = [];
    for (const userId of targets) {
      const count = await this.snacksPledgeLedgerService.settleUser(
        userId,
        message.author.userId,
      );
      if (count > 0) cleared.push(`<@${userId}> (${count})`);
    }

    if (cleared.length === 0) {
      await thread.post('Nothing pending on them. Clean slate 🧼');
      return;
    }
    await thread.post(`Settled: ${cleared.join(', ')}. Respect. 🙏`);
  }

  private resolveSettleTargets(
    message: import('chat').Message,
    command: SnackCommand,
  ): string[] {
    const rawText = (message.raw as { text?: string } | undefined)?.text ?? '';
    const mentioned = [...rawText.matchAll(/<@([A-Z0-9]+)>/g)].map(
      (match) => match[1],
    );
    const botUserId = this.configService.get<string>('SLACK_BOT_USER_ID');

    let targets = botUserId
      ? mentioned.filter((id) => id !== botUserId)
      : mentioned.slice(1); // drop the leading @-mention that triggered the bot

    targets = [...new Set(targets)];
    if (targets.length === 0 && command.settleSelf)
      return [message.author.userId];
    return targets;
  }

  private async buildDebtorSummary(): Promise<string> {
    const debtors = await this.snacksPledgeLedgerService.listOpenDebtors();
    if (debtors.length === 0)
      return 'No pending snacks. Suspiciously wholesome. 🍩';
    const lines = debtors.map(
      (debtor) => `• ${debtor.fullName} — ${debtor.openCount} pending`,
    );
    return `Snacks pending:\n${lines.join('\n')}`;
  }
}
