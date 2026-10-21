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
import { CODING_AGENT, type CodingAgent } from '../agent/coding.agent';
import { REPO_DIR } from '../agent/coding.settings';
import { LocalSandboxSession } from '../sandbox/local-sandbox-session';
import { CodingSessionRepository } from '../services/coding-session.repository';
import {
  CODING_AGENT_QUEUE,
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
  type CodingTaskJob,
} from '../queues/coding-agent.queue';

const PREVIEW_LENGTH = 300;

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
    const logger = new Logger(`CodingTask job ${job.id}`);
    const { threadId, repo, task } = job.data;
    const sessionId = this.codingSessionRepository.createSessionId(threadId);
    const rootDir = this.codingSessionRepository.getRootDir(sessionId);
    await mkdir(join(rootDir, REPO_DIR), { recursive: true });
    const codingSession = (await this.codingSessionRepository.find(
      sessionId,
    )) ?? { repo };
    logger.log(
      `${codingSession.resumeState ? 'resuming' : 'starting'} session ${sessionId} for ${repo}: ${this.preview(task)}`,
    );

    const harnessSession = await this.codingAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir, this.githubToken),
      resumeFrom: codingSession.resumeState,
    });
    const { text, steps } = await this.codingAgent.generate({
      session: harnessSession,
      prompt: [
        `Repository: ${codingSession.repo}`,
        `Working branch: coding-agent/${sessionId}`,
        '',
        task,
      ].join('\n'),
      onStepStart: ({ stepNumber }) =>
        logger.log(`step ${stepNumber}: waiting for the model`),
      onStepEnd: ({ stepNumber, finishReason, text: stepText }) =>
        logger.log(
          `step ${stepNumber} done (${finishReason}): ${this.preview(stepText)}`,
        ),
      onToolExecutionStart: ({ toolCall }) =>
        logger.log(
          `${toolCall.toolName} started: ${this.preview(toolCall.input)}`,
        ),
      onToolExecutionEnd: ({ toolCall, toolOutput, toolExecutionMs }) =>
        logger.log(
          `${toolCall.toolName} ${toolOutput.type === 'tool-error' ? 'failed' : 'done'} in ${toolExecutionMs}ms: ${this.preview(toolOutput.type === 'tool-error' ? String(toolOutput.error) : toolOutput.output)}`,
        ),
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
      `job ${job?.id} failed: ${this.redact(error.message)}`,
      error.stack && this.redact(error.stack),
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`job ${jobId} stalled and will be retried`);
  }

  private preview(value: unknown): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return this.redact(text ?? '')
      .replace(/\s+/g, ' ')
      .slice(0, PREVIEW_LENGTH);
  }

  private redact(text: string): string {
    return text.split(this.githubToken).join('[redacted]');
  }
}
