import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CODING_AGENT_QUEUE,
  type CodingTaskJob,
} from '../queues/coding-agent.queue';

@Injectable()
export class CodingTaskService {
  private readonly logger = new Logger(CodingTaskService.name);

  constructor(
    @InjectQueue(CODING_AGENT_QUEUE)
    private readonly codingAgentQueue: Queue<CodingTaskJob>,
  ) {}

  async delegate(job: CodingTaskJob): Promise<void> {
    const { id } = await this.codingAgentQueue.add('task', job);
    this.logger.log(
      `queued coding task job ${id} for ${job.repo} (thread ${job.threadId})`,
    );
  }
}
