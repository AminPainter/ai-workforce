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
import {
  CODING_AGENT,
  REPO_DIR,
  type CodingAgent,
} from '../agent/coding.agent';
import { CodingTaskLog } from '../logging/coding-task-log';
import { LocalSandboxSession } from '../sandbox/local-sandbox-session';
import { CodingSessionRepository } from '../services/coding-session.repository';
import {
  CODING_AGENT_QUEUE,
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
  type CodingTaskJob,
} from '../queues/coding-agent.queue';

@Processor(CODING_AGENT_QUEUE)
export class CodingTaskProcessor extends WorkerHost {
  private readonly logger = new Logger(CodingTaskProcessor.name);
  private readonly githubToken: string;

  constructor(
    @Inject(CODING_AGENT)
    private readonly codingAgent: CodingAgent,
    private readonly codingSessionRepository: CodingSessionRepository,
    @InjectQueue(CODING_TASK_SLACK_SUMMARY_QUEUE)
    private readonly codingTaskSlackSummaryQueue: Queue<CodingTaskSlackSummaryJob>,
    configService: ConfigService,
  ) {
    super();
    this.githubToken = configService.getOrThrow<string>('GITHUB_PAT');
  }

  async process(job: Job<CodingTaskJob>): Promise<void> {
    const { threadId, repo, task } = job.data;
    const sessionId = this.codingSessionRepository.createSessionId(threadId);
    const codingTaskLog = new CodingTaskLog(
      `job ${job.id} session ${sessionId}`,
      [this.githubToken],
    );
    codingTaskLog.log(
      `received task for ${repo} (thread ${threadId}, attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}): ${codingTaskLog.preview(task)}`,
    );

    const rootDir = this.codingSessionRepository.getRootDir(sessionId);
    await mkdir(join(rootDir, REPO_DIR), { recursive: true });
    const codingSession = (await this.codingSessionRepository.find(
      sessionId,
    )) ?? { repo };
    codingTaskLog.log(
      `${codingSession.resumeState ? 'resuming' : 'starting new'} coding session in ${rootDir}`,
    );

    const sandboxSession = new LocalSandboxSession(
      rootDir,
      this.githubToken,
      codingTaskLog,
    );
    codingTaskLog.startHeartbeat(() =>
      sandboxSession.describeRunningCommands(),
    );
    try {
      const harnessSession = await this.codingAgent.createSession({
        sessionId,
        sandboxSession,
        resumeFrom: codingSession.resumeState,
      });
      codingTaskLog.log(
        `harness session ready after ${codingTaskLog.elapsed()}`,
      );

      const { text, steps, totalUsage } = await this.codingAgent.generate({
        session: harnessSession,
        prompt: [
          `Repository: ${codingSession.repo}`,
          `Working branch: coding-agent/${sessionId}`,
          '',
          task,
        ].join('\n'),
        onStepStart: codingTaskLog.onStepStart,
        onStepEnd: codingTaskLog.onStepEnd,
        onToolExecutionStart: codingTaskLog.onToolExecutionStart,
        onToolExecutionEnd: codingTaskLog.onToolExecutionEnd,
      });
      codingTaskLog.log(
        `agent finished after ${codingTaskLog.elapsed()}, ${steps.length} steps, tokens in/out ${totalUsage.inputTokens ?? '?'}/${totalUsage.outputTokens ?? '?'}: ${codingTaskLog.preview(text)}`,
      );

      codingSession.resumeState = await harnessSession.stop();
      await this.codingSessionRepository.save(sessionId, codingSession);
      codingTaskLog.log('session state saved');

      await this.codingTaskSlackSummaryQueue.add('slack-summary', {
        threadId,
        text,
      });
      codingTaskLog.log('Slack summary queued');
    } catch (error) {
      codingTaskLog.error(`failed after ${codingTaskLog.elapsed()}`, error);
      throw error;
    } finally {
      codingTaskLog.stopHeartbeat();
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<CodingTaskJob>): void {
    this.logger.log(`job ${job.id} picked up`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CodingTaskJob>): void {
    this.logger.log(`job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CodingTaskJob> | undefined, error: Error): void {
    this.logger.error(
      `job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts ?? 1}): ${error.message.split(this.githubToken).join('[redacted]')}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(
      `job ${jobId} stalled; its lock expired and BullMQ will retry it`,
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`worker error: ${error.message}`, error.stack);
  }
}
