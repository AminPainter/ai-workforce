import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT,
  type GitHubPullRequestMergedToMainEvent,
} from '../github/github.events.js';
import {
  KONG_ROUTE_SYNC_QUEUE,
  type KongRouteSyncJob,
} from './queues/kong-route-sync.queue.js';
import { SOURCE_REPO, authorDenylist } from './kong-route-sync.config.js';

@Injectable()
export class KongRouteSyncListener {
  private readonly logger = new Logger(KongRouteSyncListener.name);
  private readonly authorDenylist: Set<string>;

  constructor(
    @InjectQueue(KONG_ROUTE_SYNC_QUEUE)
    private readonly kongRouteSyncQueue: Queue<KongRouteSyncJob>,
    configService: ConfigService,
  ) {
    this.authorDenylist = authorDenylist(configService);
  }

  @OnEvent(GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT)
  async onPullRequestMergedToMain({
    id,
    payload,
  }: GitHubPullRequestMergedToMainEvent): Promise<void> {
    const pullRequestOnRailsApp = payload.pull_request;
    const prRef = `${payload.repository.full_name}#${pullRequestOnRailsApp.number}`;
    this.logger.log(
      `received merged PR ${prRef} by ${pullRequestOnRailsApp.user.login}`,
    );
    if (payload.repository.full_name !== SOURCE_REPO) {
      this.logger.log(`skipping ${prRef}: not ${SOURCE_REPO}`);
      return;
    }
    if (
      this.authorDenylist.has(pullRequestOnRailsApp.user.login.toLowerCase())
    ) {
      this.logger.log(
        `skipping ${prRef}: author ${pullRequestOnRailsApp.user.login} is deny-listed`,
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
            authorUsername: pullRequestOnRailsApp.user.login,
            mergeSha: pullRequestOnRailsApp.merge_commit_sha,
          },
        },
        { jobId: id },
      );
      this.logger.log(`queued routes detection for ${prRef} (delivery ${id})`);
    } catch (error) {
      this.logger.error(
        `failed to queue routes detection for ${prRef}: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
