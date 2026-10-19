import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import {
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
} from '../queues/coding-agent.queue';

@Processor(CODING_TASK_SLACK_SUMMARY_QUEUE)
export class CodingTaskSlackSummaryProcessor extends WorkerHost {
  constructor(private readonly slackBotService: SlackBotService) {
    super();
  }

  async process(job: Job<CodingTaskSlackSummaryJob>): Promise<void> {
    await this.slackBotService.postToThread(job.data.threadId, job.data.text);
  }
}
