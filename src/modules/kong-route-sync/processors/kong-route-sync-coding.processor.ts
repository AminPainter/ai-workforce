import { Inject, Logger } from '@nestjs/common';
import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { REPO_DIR } from '../../coding-agent/agent/coding.settings.js';
import { LocalSandboxSession } from '../../coding-agent/sandbox/local-sandbox-session.js';
import { CodingSessionRepository } from '../../coding-agent/services/coding-session.repository.js';
import { GitHubAppAuthService } from '../../github/services/github-app-auth.service.js';
import { TARGET_REPO } from '../kong-route-sync.config.js';
import {
  KONG_ROUTE_SYNC_CODING_AGENT,
  type KongRouteSyncCodingAgentFactory,
} from '../agent/kong-route-sync-coding.agent.js';
import {
  SUBMIT_ROUTE_SYNC_RESULT_TOOL,
  submitRouteSyncResultInputSchema,
} from '../tools/submit-route-sync-result.tool.js';
import {
  buildKongRouteSyncTask,
  kongRouteSyncBranch,
} from '../agent/kong-route-sync.prompt.js';
import {
  KONG_ROUTE_SYNC_CODING_QUEUE,
  KONG_ROUTE_SYNC_NOTIFICATION_QUEUE,
  type KongRouteSyncCodingJob,
  type KongRouteSyncNotificationJob,
} from '../queues/kong-route-sync.queue.js';

@Processor(KONG_ROUTE_SYNC_CODING_QUEUE)
export class KongRouteSyncCodingProcessor extends WorkerHost {
  private readonly logger = new Logger(KongRouteSyncCodingProcessor.name);

  constructor(
    @Inject(KONG_ROUTE_SYNC_CODING_AGENT)
    private readonly kongRouteSyncCodingAgentFactory: KongRouteSyncCodingAgentFactory,
    private readonly codingSessionRepository: CodingSessionRepository,
    @InjectQueue(KONG_ROUTE_SYNC_NOTIFICATION_QUEUE)
    private readonly kongRouteSyncNotificationQueue: Queue<KongRouteSyncNotificationJob>,
    private readonly gitHubAppAuthService: GitHubAppAuthService,
  ) {
    super();
  }

  async process(job: Job<KongRouteSyncCodingJob>): Promise<void> {
    const { pullRequestOnRailsApp, authorEmail } = job.data;
    const prRef = `${pullRequestOnRailsApp.repo}#${pullRequestOnRailsApp.number}`;
    const logger = new Logger(`KongRouteSyncCoding ${prRef}`);
    const sessionId = this.codingSessionRepository.createSessionId(
      `kong-route-sync:${prRef}`,
    );
    const rootDir = this.codingSessionRepository.getRootDir(sessionId);
    await mkdir(join(rootDir, REPO_DIR), { recursive: true });

    logger.log(
      `starting coding agent session ${sessionId} to sync ${job.data.routesFiles.map((file) => file.filename).join(', ')} into ${TARGET_REPO}`,
    );
    const kongRouteSyncCodingAgent = this.kongRouteSyncCodingAgentFactory(
      await this.gitHubAppAuthService.getInstallationToken(),
    );
    const harnessSession = await kongRouteSyncCodingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir, () =>
        this.gitHubAppAuthService.getInstallationToken(),
      ),
    });
    try {
      const { text, steps } = await kongRouteSyncCodingAgent.generate({
        session: harnessSession,
        prompt: [
          `Repository: ${TARGET_REPO}`,
          `Working branch: ${kongRouteSyncBranch(pullRequestOnRailsApp.number)}`,
          '',
          buildKongRouteSyncTask(job.data),
        ].join('\n'),
      });
      logger.log(`agent finished after ${steps.length} steps`);
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
      logger.log(`kong sync result: ${JSON.stringify(result)}`);

      await this.kongRouteSyncNotificationQueue.add('notify', {
        pullRequestOnRailsApp,
        authorEmail,
        result,
      });
      logger.log('queued author notification');
    } finally {
      await harnessSession.stop();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<KongRouteSyncCodingJob> | undefined, error: Error): void {
    this.logger.error(`job ${job?.id} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`job ${jobId} stalled`);
  }
}
