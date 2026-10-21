import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Octokit } from '@octokit/rest';
import { isRoutesFile } from '../utils/routes-files';
import {
  KONG_ROUTE_SYNC_CODING_QUEUE,
  KONG_ROUTE_SYNC_QUEUE,
  type KongRouteSyncCodingJob,
  type KongRouteSyncJob,
  type RailsAppPullRequest,
} from '../queues/kong-route-sync.queue';

@Processor(KONG_ROUTE_SYNC_QUEUE)
export class KongRouteSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(KongRouteSyncProcessor.name);
  constructor(
    private readonly octokit: Octokit,
    @InjectQueue(KONG_ROUTE_SYNC_CODING_QUEUE)
    private readonly kongRouteSyncCodingQueue: Queue<KongRouteSyncCodingJob>,
  ) {
    super();
  }

  async process(job: Job<KongRouteSyncJob>): Promise<void> {
    const { pullRequestOnRailsApp } = job.data;
    const prRef = `${pullRequestOnRailsApp.repo}#${pullRequestOnRailsApp.number}`;

    const files = await this.octokit.paginate(
      this.octokit.rest.pulls.listFiles,
      {
        ...this.repoParams(pullRequestOnRailsApp),
        pull_number: pullRequestOnRailsApp.number,
        per_page: 100,
      },
    );
    const routesFiles = files.filter(isRoutesFile);
    if (routesFiles.length === 0) {
      this.logger.log(`${prRef} does not touch routes files; skipping`);
      return;
    }

    this.logger.log(
      `${prRef} touches ${routesFiles.map((file) => file.filename).join(', ')}; queueing kong sync`,
    );
    await this.kongRouteSyncCodingQueue.add(
      'sync',
      {
        pullRequestOnRailsApp,
        authorEmail: await this.findAuthorEmail(pullRequestOnRailsApp),
        routesFiles: routesFiles.map(({ filename, status, patch }) => ({
          filename,
          status,
          patch,
        })),
      },
      { jobId: prRef, attempts: 1 },
    );
  }

  private async findAuthorEmail(
    pullRequestOnRailsApp: RailsAppPullRequest,
  ): Promise<string> {
    const commits = await this.octokit.paginate(
      this.octokit.rest.pulls.listCommits,
      {
        ...this.repoParams(pullRequestOnRailsApp),
        pull_number: pullRequestOnRailsApp.number,
        per_page: 100,
      },
    );
    const login = pullRequestOnRailsApp.authorLogin.toLowerCase();
    return commits.find(
      (commit) => commit.author?.login.toLowerCase() === login,
    )!.commit.author!.email!;
  }

  private repoParams({ repo }: RailsAppPullRequest) {
    const [owner, name] = repo.split('/');
    return { owner, repo: name };
  }
}
