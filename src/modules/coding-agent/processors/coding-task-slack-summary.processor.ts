import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import {
  CODING_AGENT_REPLIES_QUEUE,
  type CodingReplyJob,
} from '../queues/coding-agent.queue';

@Processor(CODING_AGENT_REPLIES_QUEUE)
export class CodingTaskSlackSummaryProcessor extends WorkerHost {
  constructor(private readonly slackBotService: SlackBotService) {
    super();
  }

  async process(job: Job<CodingReplyJob>): Promise<void> {
    await this.slackBotService.postToThread(job.data.threadId, job.data.text);
  }
}
