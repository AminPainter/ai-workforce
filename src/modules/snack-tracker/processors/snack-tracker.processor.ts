import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import { SnacksLedgerService } from '../services/snacks-ledger.service';
import { SNACKS_PLEDGE_CLASSIFIER } from '../agents/snacks-pledge-classifier.agent';
import type { SnacksPledgeClassification } from '../agents/snacks-pledge-classifier.schema';
import {
  SNACK_TRACKER_QUEUE,
  type SnacksPledgeJob,
} from '../queues/snack-tracker.queue';

const CONFIRMATION_MESSAGE =
  'Hehe 😈 noted — snacks are officially pending on you.';

@Processor(SNACK_TRACKER_QUEUE)
export class SnackTrackerProcessor extends WorkerHost {
  private readonly logger = new Logger(SnackTrackerProcessor.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly snacksLedgerService: SnacksLedgerService,
    private readonly slackBotService: SlackBotService,
  ) {
    super();
  }

  async process(job: Job<SnacksPledgeJob>): Promise<void> {
    const { threadId, messageId, text, userId, userName, fullName } = job.data;

    const { output: classification } = (await this.agentRegistry
      .get(SNACKS_PLEDGE_CLASSIFIER)
      .generate({ messages: [{ role: 'user', content: text }] })) as {
      output: SnacksPledgeClassification;
    };
    if (!classification.isSnacksPledge) return;

    const { isFreshlyRecorded } =
      await this.snacksLedgerService.recordSnacksPledge({
        messageId,
        userId,
        userName,
        fullName,
        text,
        pledgedAt: new Date().toISOString(),
      });
    if (!isFreshlyRecorded) return;

    this.logger.log(`snacks pledge recorded for ${fullName}`);
    await this.slackBotService.postToThread(threadId, CONFIRMATION_MESSAGE);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`job ${job.id} failed: ${error.message}`);
  }
}
