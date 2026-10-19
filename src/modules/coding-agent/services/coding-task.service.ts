import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CODING_AGENT_QUEUE,
  type CodingTurnJob,
} from '../queues/coding-agent.queue';

@Injectable()
export class CodingTaskService {
  constructor(
    @InjectQueue(CODING_AGENT_QUEUE)
    private readonly codingAgentQueue: Queue<CodingTurnJob>,
  ) {}

  async delegate(job: CodingTurnJob): Promise<void> {
    await this.codingAgentQueue.add('turn', job);
  }
}
