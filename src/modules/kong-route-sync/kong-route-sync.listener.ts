import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT,
  type GitHubPullRequestMergedToMainEvent,
} from '../github/github.events';
import {
  KONG_ROUTE_SYNC_QUEUE,
  type KongRouteSyncJob,
} from './queues/kong-route-sync.queue';
import { authorDenylist, sourceRepo } from './kong-route-sync.config';

@Injectable()
export class KongRouteSyncListener {
  private readonly logger = new Logger(KongRouteSyncListener.name);
  private readonly sourceRepo: string;
  private readonly authorDenylist: Set<string>;

  constructor(
    @InjectQueue(KONG_ROUTE_SYNC_QUEUE)
    private readonly kongRouteSyncQueue: Queue<KongRouteSyncJob>,
    configService: ConfigService,
  ) {
    this.sourceRepo = sourceRepo(configService);
    this.authorDenylist = authorDenylist(configService);
  }

  @OnEvent(GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT)
  async onPullRequestMergedToMain({
    id,
    payload,
  }: GitHubPullRequestMergedToMainEvent): Promise<void> {
    const pullRequestOnRailsApp = payload.pull_request;
    if (payload.repository.full_name !== this.sourceRepo) return;
    if (
      this.authorDenylist.has(pullRequestOnRailsApp.user.login.toLowerCase())
    ) {
      this.logger.log(
        `skipping PR #${pullRequestOnRailsApp.number}: author ${pullRequestOnRailsApp.user.login} is deny-listed`,
      );
      return;
    }

    try {
      await this.kongRouteSyncQueue.add(
        'detect',
        {
          pullRequestOnRailsApp: {
            repo: payload.repository.full_name,
            number: pullRequestOnRailsApp.number,
            url: pullRequestOnRailsApp.html_url,
            title: pullRequestOnRailsApp.title,
            authorLogin: pullRequestOnRailsApp.user.login,
            mergeSha: pullRequestOnRailsApp.merge_commit_sha,
          },
        },
        { jobId: id },
      );
    } catch (error) {
      this.logger.error(error);
    }
  }
}
