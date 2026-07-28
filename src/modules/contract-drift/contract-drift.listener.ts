import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  GITHUB_PULL_REQUEST_EVENT,
  type GitHubPullRequestEvent,
} from '../github/github.events';
import { CONTRACT_DRIFT_QUEUE } from './queues/contract-drift.queue';

@Injectable()
export class ContractDriftListener {
  private readonly logger = new Logger(ContractDriftListener.name);

  constructor(
    @InjectQueue(CONTRACT_DRIFT_QUEUE)
    private readonly contractDriftQueue: Queue,
  ) {}

  @OnEvent(GITHUB_PULL_REQUEST_EVENT)
  async onPullRequest({ id, payload }: GitHubPullRequestEvent): Promise<void> {
    try {
      if (payload.action !== 'closed') {
        this.logger.debug(`ignored PR action: ${payload.action}`);
        return;
      }

      const pullRequest = payload.pull_request;
      if (!pullRequest.merged) {
        this.logger.debug(
          `ignored closed-without-merge PR #${pullRequest.number}`,
        );
        return;
      }

      if (pullRequest.base.ref !== 'main') {
        this.logger.debug(`ignored PR base ref: ${pullRequest.base.ref}`);
        return;
      }

      await this.contractDriftQueue.add('analyze', { payload }, { jobId: id });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
