import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
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
  private readonly repoAllowlist: Set<string>;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(CONTRACT_DRIFT_QUEUE)
    private readonly contractDriftQueue: Queue,
  ) {
    this.repoAllowlist = new Set(
      (this.configService.get<string>('GITHUB_WEBHOOK_REPOS') ?? '')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
    );
  }

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

      const fullName = payload.repository.full_name;
      if (this.repoAllowlist.size > 0 && !this.repoAllowlist.has(fullName)) {
        this.logger.debug(`ignored repo: ${fullName}`);
        return;
      }

      await this.contractDriftQueue.add('analyze', { payload }, { jobId: id });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
