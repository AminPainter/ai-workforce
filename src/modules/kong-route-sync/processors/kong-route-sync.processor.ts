import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { GitHubApiService } from '../../github/services/github-api.service';
import { isRoutesFile } from '../utils/routes-files';
import { targetRepo } from '../kong-route-sync.config';
import {
  KONG_ROUTE_SYNC_CODING_QUEUE,
  KONG_ROUTE_SYNC_QUEUE,
  type KongRouteSyncCodingJob,
  type KongRouteSyncJob,
  type SourcePullRequest,
} from '../queues/kong-route-sync.queue';

const GITHUB_NOREPLY_EMAIL = /@users\.noreply\.github\.com$/i;

@Processor(KONG_ROUTE_SYNC_QUEUE)
export class KongRouteSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(KongRouteSyncProcessor.name);
  private readonly targetRepo: string;

  constructor(
    private readonly gitHubApiService: GitHubApiService,
    @InjectQueue(KONG_ROUTE_SYNC_CODING_QUEUE)
    private readonly kongRouteSyncCodingQueue: Queue<KongRouteSyncCodingJob>,
    configService: ConfigService,
  ) {
    super();
    this.targetRepo = targetRepo(configService);
  }

  async process(job: Job<KongRouteSyncJob>): Promise<void> {
    const { pullRequest } = job.data;
    const prRef = `${pullRequest.repo}#${pullRequest.number}`;

    const files = await this.gitHubApiService.listPullRequestFiles(
      pullRequest.repo,
      pullRequest.number,
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
        pullRequest,
        authorEmail: await this.findAuthorEmail(pullRequest),
        targetRepo: this.targetRepo,
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
    pullRequest: SourcePullRequest,
  ): Promise<string | null> {
    const commits = await this.gitHubApiService.listPullRequestCommits(
      pullRequest.repo,
      pullRequest.number,
    );
    const login = pullRequest.authorLogin.toLowerCase();
    const email = commits
      .filter((commit) => commit.author?.login.toLowerCase() === login)
      .map((commit) => commit.commit.author?.email)
      .find((email) => email && !GITHUB_NOREPLY_EMAIL.test(email));
    return email ?? null;
  }
}
