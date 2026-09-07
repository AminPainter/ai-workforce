import { Injectable, Logger } from '@nestjs/common';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { SnacksLedgerService } from './snacks-ledger.service';
import { SNACKS_PLEDGE_CLASSIFIER } from '../agents/snacks-pledge-classifier.agent';
import type { SnacksPledgeClassification } from '../agents/snacks-pledge-classifier.schema';

const CONFIRMATION_MESSAGE =
  'Hehe 😈 noted — snacks are officially pending on you.';

@Injectable()
export class SnackTrackerService {
  private readonly logger = new Logger(SnackTrackerService.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly snacksLedgerService: SnacksLedgerService,
  ) {}

  async handlePotentialSnacksPledge(
    thread: import('chat').Thread,
    message: import('chat').Message,
  ): Promise<void> {
    if (message.author.isBot === true || message.author.isMe) return;
    const text = message.text?.trim();
    if (!text) return;

    const { output: classification } = (await this.agentRegistry
      .get(SNACKS_PLEDGE_CLASSIFIER)
      .generate({ messages: [{ role: 'user', content: text }] })) as {
      output: SnacksPledgeClassification;
    };
    if (!classification.isSnacksPledge) return;

    const recorded = await this.snacksLedgerService.recordSnacksPledge({
      messageId: message.id,
      userId: message.author.userId,
      userName: message.author.userName,
      fullName: message.author.fullName,
      text,
      pledgedAt: new Date().toISOString(),
    });
    if (!recorded) return;

    this.logger.log(`snacks pledge recorded for ${message.author.fullName}`);
    await thread.post(CONFIRMATION_MESSAGE);
  }
}
