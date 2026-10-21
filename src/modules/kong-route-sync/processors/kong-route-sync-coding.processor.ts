import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { REPO_DIR } from '../../coding-agent/agent/coding.settings';
import { LocalSandboxSession } from '../../coding-agent/sandbox/local-sandbox-session';
import { CodingSessionRepository } from '../../coding-agent/services/coding-session.repository';
import { TARGET_REPO } from '../kong-route-sync.config';
import {
  KONG_ROUTE_SYNC_CODING_AGENT,
  type KongRouteSyncCodingAgent,
} from '../agent/kong-route-sync-coding.agent';
import {
  SUBMIT_ROUTE_SYNC_RESULT_TOOL,
  submitRouteSyncResultInputSchema,
} from '../tools/submit-route-sync-result.tool';
import {
  buildKongRouteSyncTask,
  kongRouteSyncBranch,
} from '../agent/kong-route-sync.prompt';
import {
  KONG_ROUTE_SYNC_CODING_QUEUE,
  KONG_ROUTE_SYNC_NOTIFICATION_QUEUE,
  type KongRouteSyncCodingJob,
  type KongRouteSyncNotificationJob,
} from '../queues/kong-route-sync.queue';

@Processor(KONG_ROUTE_SYNC_CODING_QUEUE)
export class KongRouteSyncCodingProcessor extends WorkerHost {
  private readonly logger = new Logger(KongRouteSyncCodingProcessor.name);
  private readonly githubToken: string;

  constructor(
    @Inject(KONG_ROUTE_SYNC_CODING_AGENT)
    private readonly kongRouteSyncCodingAgent: KongRouteSyncCodingAgent,
    private readonly codingSessionRepository: CodingSessionRepository,
    @InjectQueue(KONG_ROUTE_SYNC_NOTIFICATION_QUEUE)
    private readonly kongRouteSyncNotificationQueue: Queue<KongRouteSyncNotificationJob>,
    configService: ConfigService,
  ) {
    super();
    this.githubToken = configService.getOrThrow<string>('GITHUB_PAT');
  }

  async process(job: Job<KongRouteSyncCodingJob>): Promise<void> {
    const { pullRequestOnRailsApp, authorEmail } = job.data;
    const sessionId = this.codingSessionRepository.createSessionId(
      `kong-route-sync:${pullRequestOnRailsApp.repo}#${pullRequestOnRailsApp.number}`,
    );
    const rootDir = this.codingSessionRepository.getRootDir(sessionId);
    await mkdir(join(rootDir, REPO_DIR), { recursive: true });

    const harnessSession = await this.kongRouteSyncCodingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir, this.githubToken),
    });
    try {
      const { text, steps } = await this.kongRouteSyncCodingAgent.generate({
        session: harnessSession,
        prompt: [
          `Repository: ${TARGET_REPO}`,
          `Working branch: ${kongRouteSyncBranch(pullRequestOnRailsApp.number)}`,
          '',
          buildKongRouteSyncTask(job.data),
        ].join('\n'),
      });
      const submission = steps
        .flatMap((step) => step.toolResults)
        .findLast(
          (toolResult) => toolResult.toolName === SUBMIT_ROUTE_SYNC_RESULT_TOOL,
        );
      if (!submission)
        throw new Error(
          `agent finished without calling ${SUBMIT_ROUTE_SYNC_RESULT_TOOL}: ${text.slice(-500)}`,
        );
      const { result } = submitRouteSyncResultInputSchema.parse(
        submission.input,
      );
      this.logger.log(
        `kong sync for ${pullRequestOnRailsApp.repo}#${pullRequestOnRailsApp.number}: ${JSON.stringify(result)}`,
      );

      await this.kongRouteSyncNotificationQueue.add('notify', {
        pullRequestOnRailsApp,
        authorEmail,
        result,
      });
    } finally {
      await harnessSession.stop();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(`job ${job.id} failed: ${err.message}`);
  }
}
