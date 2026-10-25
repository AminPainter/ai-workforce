import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SlackBotService } from '../../slack/services/slack-bot.service.js';
import {
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
} from '../queues/coding-agent.queue.js';

@Processor(CODING_TASK_SLACK_SUMMARY_QUEUE)
export class CodingTaskSlackSummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(CodingTaskSlackSummaryProcessor.name);

  constructor(private readonly slackBotService: SlackBotService) {
    super();
  }

  async process(job: Job<CodingTaskSlackSummaryJob>): Promise<void> {
    await this.slackBotService.postToThread(job.data.threadId, job.data.text);
    this.logger.log(
      `posted coding task summary to thread ${job.data.threadId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<CodingTaskSlackSummaryJob> | undefined,
    error: Error,
  ): void {
    this.logger.error(
      `failed to post coding task summary to thread ${job?.data.threadId}: ${error.message}`,
    );
  }
}
