import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  GITHUB_PULL_REQUEST_OPENED_AGAINST_MAIN_EVENT,
  type GitHubPullRequestOpenedAgainstMainEvent,
} from '../github/github.events';
import {
  KONG_ROUTE_SYNC_QUEUE,
  type KongRouteSyncJob,
} from './queues/kong-route-sync.queue';
import { SOURCE_REPO, authorDenylist } from './kong-route-sync.config';

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

  // TODO: switch back to GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT once the sync is tested.
  @OnEvent(GITHUB_PULL_REQUEST_OPENED_AGAINST_MAIN_EVENT)
  async onPullRequestOpenedAgainstMain({
    id,
    payload,
  }: GitHubPullRequestOpenedAgainstMainEvent): Promise<void> {
    const pullRequestOnRailsApp = payload.pull_request;
    const prRef = `${payload.repository.full_name}#${pullRequestOnRailsApp.number}`;
    this.logger.log(
      `received opened PR ${prRef} by ${pullRequestOnRailsApp.user.login}`,
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
      this.logger.error(`failed to queue routes detection for ${prRef}`, error);
    }
  }
}
