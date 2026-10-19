import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CODING_AGENT_QUEUE,
  type CodingTaskJob,
} from '../queues/coding-agent.queue';

@Injectable()
export class CodingTaskService {
  constructor(
    @InjectQueue(CODING_AGENT_QUEUE)
    private readonly codingAgentQueue: Queue<CodingTaskJob>,
  ) {}

  async delegate(job: CodingTaskJob): Promise<void> {
    await this.codingAgentQueue.add('task', job);
  }
}
