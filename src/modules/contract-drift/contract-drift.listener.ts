import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT,
  type GitHubPullRequestMergedToMainEvent,
} from '../github/github.events';
import { CONTRACT_DRIFT_QUEUE } from './queues/contract-drift.queue';

@Injectable()
export class ContractDriftListener {
  private readonly logger = new Logger(ContractDriftListener.name);

  constructor(
    @InjectQueue(CONTRACT_DRIFT_QUEUE)
    private readonly contractDriftQueue: Queue,
  ) {}

  @OnEvent(GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT)
  async onPullRequestMergedToMain({
    id,
    payload,
  }: GitHubPullRequestMergedToMainEvent): Promise<void> {
    try {
      await this.contractDriftQueue.add('analyze', { payload }, { jobId: id });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
