import { Inject, Logger } from '@nestjs/common';
import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { AiModel } from '../../ai/constants/ai-models.js';
import { LocalSandboxSession } from '../../coding-agent/sandbox/local-sandbox-session.js';
import {
  CODING_TASK_SLACK_SUMMARY_QUEUE,
  type CodingTaskSlackSummaryJob,
} from '../../coding-agent/queues/coding-agent.queue.js';
import {
  harnessStepLogging,
  previewForLog,
} from '../../coding-agent/utils/harness-step-logger.js';
import {
  ARTIFACT_BUILDER_AGENT,
  SITE_DIR,
  type ArtifactBuilderAgentFactory,
} from '../agent/artifact-builder.agent.js';
import { buildArtifactTask } from '../agent/artifact-builder.prompt.js';
import { ArtifactSessionRepository } from '../services/artifact-session.repository.js';
import { ARTIFACT_FILE } from '../constants/artifact-file.js';
import {
  ARTIFACT_BUILD_QUEUE,
  ARTIFACT_PUBLISH_QUEUE,
  type ArtifactBuildJob,
  type ArtifactPublishJob,
} from '../queues/artifact.queue.js';

const BUILD_TIMEOUT_MS = 15 * 60 * 1000;

@Processor(ARTIFACT_BUILD_QUEUE)
export class ArtifactBuildProcessor extends WorkerHost {
  private readonly logger = new Logger(ArtifactBuildProcessor.name);

  constructor(
    @Inject(ARTIFACT_BUILDER_AGENT)
    private readonly artifactBuilderAgentFactory: ArtifactBuilderAgentFactory,
    private readonly artifactSessionRepository: ArtifactSessionRepository,
    @InjectQueue(ARTIFACT_PUBLISH_QUEUE)
    private readonly artifactPublishQueue: Queue<ArtifactPublishJob>,
    @InjectQueue(CODING_TASK_SLACK_SUMMARY_QUEUE)
    private readonly codingTaskSlackSummaryQueue: Queue<CodingTaskSlackSummaryJob>,
  ) {
    super();
  }

  async process(job: Job<ArtifactBuildJob>): Promise<void> {
    const logger = new Logger(`ArtifactBuild job ${job.id}`);
    const { threadId, requesterUserId, title, brief, baseHtml } = job.data;
    const sessionId = this.artifactSessionRepository.createSessionId(threadId);
    const rootDir = this.artifactSessionRepository.getRootDir(sessionId);
    const siteDir = join(rootDir, SITE_DIR);
    await rm(siteDir, { recursive: true, force: true });
    await mkdir(siteDir, { recursive: true });
    if (baseHtml) await writeFile(join(siteDir, ARTIFACT_FILE), baseHtml);
    const artifactSession =
      (await this.artifactSessionRepository.find(sessionId)) ?? {};
    logger.log(
      `${artifactSession.resumeState ? 'resuming' : 'starting'} session ${sessionId} to ${baseHtml ? 'revise' : 'build'} "${title}": ${previewForLog(brief)}`,
    );

    const artifactBuilderAgent = this.artifactBuilderAgentFactory(siteDir);
    const harnessSession = await artifactBuilderAgent.createSession({
      sessionId,
      sandboxSession: new LocalSandboxSession(rootDir),
      resumeFrom: artifactSession.resumeState,
    });
    try {
      const { steps } = await artifactBuilderAgent.generate({
        session: harnessSession,
        prompt: buildArtifactTask(title, brief, baseHtml !== undefined),
        abortSignal: AbortSignal.timeout(BUILD_TIMEOUT_MS),
        ...harnessStepLogging(logger),
      });
      logger.log(`agent finished after ${steps.length} steps`);
    } catch (error) {
      await harnessSession.stop();
      throw error;
    }
    const resumeState = await harnessSession.stop();

    const html = await readFile(join(siteDir, ARTIFACT_FILE), 'utf8').catch(
      () => undefined,
    );
    if (html === undefined)
      throw new Error(`agent finished without writing ${ARTIFACT_FILE}`);

    await this.artifactSessionRepository.save(sessionId, { resumeState });
    await this.artifactPublishQueue.add(
      'publish',
      {
        threadId,
        requesterUserId,
        title,
        html,
        model: AiModel.CLAUDE_OPUS_5_5,
      },
      { jobId: `artifact-build-${job.id}`, removeOnComplete: true },
    );
    logger.log(`queued publish of ${Buffer.byteLength(html, 'utf8')} bytes`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ArtifactBuildJob>, error: Error): Promise<void> {
    this.logger.error(`job ${job.id} failed: ${error.message}`, error.stack);
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await this.codingTaskSlackSummaryQueue
      .add('slack-summary', {
        threadId: job.data.threadId,
        text: `I couldn't build "${job.data.title}". Ask me again to retry.`,
      })
      .catch((queueError: unknown) =>
        this.logger.error(
          `failed to queue artifact failure note: ${String(queueError)}`,
        ),
      );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`job ${jobId} stalled and will be retried`);
  }
}
