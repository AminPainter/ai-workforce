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
import {
  CODING_AGENT,
  type CodingAgentFactory,
} from '../agent/coding.agent.js';
import { REPO_DIR } from '../agent/coding.settings.js';
import { LocalSandboxSession } from '../sandbox/local-sandbox-session.js';
import { CodingSessionRepository } from '../services/coding-session.repository.js';
import {
  harnessStepLogging,
  previewForLog,
  redactSecrets,
} from '../utils/harness-step-logger.js';
import { GitHubAppAuthService } from '../../github/services/github-app-auth.service.js';
import {
  CODING_AGENT_QUEUE,
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
  type CodingTaskJob,
} from '../queues/coding-agent.queue.js';

@Processor(CODING_AGENT_QUEUE)
export class CodingTaskProcessor extends WorkerHost {
  private readonly logger = new Logger(CodingTaskProcessor.name);

  constructor(
    @Inject(CODING_AGENT)
    private readonly codingAgentFactory: CodingAgentFactory,
    private readonly codingSessionRepository: CodingSessionRepository,
    @InjectQueue(CODING_TASK_SLACK_SUMMARY_QUEUE)
    private readonly codingTaskSlackSummaryQueue: Queue<CodingTaskSlackSummaryJob>,
    private readonly gitHubAppAuthService: GitHubAppAuthService,
  ) {
    super();
  }

  async process(job: Job<CodingTaskJob>): Promise<void> {
    const logger = new Logger(`CodingTask job ${job.id}`);
    const { threadId, repo, task } = job.data;
    const sessionId = this.codingSessionRepository.createSessionId(threadId);
    const rootDir = this.codingSessionRepository.getRootDir(sessionId);
    await mkdir(join(rootDir, REPO_DIR), { recursive: true });
    const codingSession = (await this.codingSessionRepository.find(
      sessionId,
    )) ?? { repo };
    logger.log(
      `${codingSession.resumeState ? 'resuming' : 'starting'} session ${sessionId} for ${repo}: ${previewForLog(task)}`,
    );

    const codingAgent = this.codingAgentFactory(
      await this.gitHubAppAuthService.getInstallationToken(),
    );
    const harnessSession = await codingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir, () =>
        this.gitHubAppAuthService.getInstallationToken(),
      ),
      resumeFrom: codingSession.resumeState,
    });
    const { text, steps } = await codingAgent.generate({
      session: harnessSession,
      prompt: [
        `Repository: ${codingSession.repo}`,
        `Working branch: coding-agent/${sessionId}`,
        '',
        task,
      ].join('\n'),
      ...harnessStepLogging(logger),
    });
    logger.log(`agent finished after ${steps.length} steps`);

    codingSession.resumeState = await harnessSession.stop();
    await this.codingSessionRepository.save(sessionId, codingSession);
    await this.codingTaskSlackSummaryQueue.add('slack-summary', {
      threadId,
      text,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CodingTaskJob> | undefined, error: Error): void {
    this.logger.error(
      `job ${job?.id} failed: ${redactSecrets(error.message)}`,
      error.stack && redactSecrets(error.stack),
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`job ${jobId} stalled and will be retried`);
  }
}
