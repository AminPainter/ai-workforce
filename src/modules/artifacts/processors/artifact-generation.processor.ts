import { createHash } from 'crypto';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service.js';
import { SlackBotService } from '../../slack/services/slack-bot.service.js';
import { ARTIFACT_GENERATOR } from '../agent/artifact-generator.agent.js';
import {
  ARTIFACT_GENERATION_QUEUE,
  type ArtifactGenerationJob,
} from '../queues/artifact.queue.js';
import { ArtifactRepository } from '../services/artifact.repository.js';
import {
  ArtifactScannerService,
  type ArtifactScanFinding,
} from '../services/artifact-scanner.service.js';
import { extractHtmlDocument } from '../utils/extract-html-document.js';

const MAX_HTML_BYTES = 2 * 1024 * 1024;

@Processor(ARTIFACT_GENERATION_QUEUE, { concurrency: 2 })
export class ArtifactGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ArtifactGenerationProcessor.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly artifactScannerService: ArtifactScannerService,
    private readonly artifactRepository: ArtifactRepository,
    private readonly slackBotService: SlackBotService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.publicBaseUrl = this.configService
      .getOrThrow<string>('SERVICE_URL')
      .replace(/\/+$/, '');
  }

  async process(job: Job<ArtifactGenerationJob>): Promise<void> {
    const artifactId = job.data.artifactId ?? (await this.generate(job));
    await this.slackBotService.postToThread(
      job.data.threadId,
      `${job.data.title}: ${this.publicBaseUrl}/artifacts/${artifactId}`,
    );
    this.logger.log(
      `posted artifact ${artifactId} to thread ${job.data.threadId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ArtifactGenerationJob>, error: Error): Promise<void> {
    this.logger.error(`job ${job.id} failed: ${error.message}`);
    const blocked = error instanceof UnrecoverableError;
    if (!blocked && job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const note = blocked
      ? `I didn't publish "${job.data.title}". The generated page had a value that looks like sensitive data (${error.message}). Ask me again with aggregates only.`
      : `I couldn't generate "${job.data.title}". Ask me again to retry.`;
    await this.slackBotService
      .postToThread(job.data.threadId, note)
      .catch((postError: unknown) =>
        this.logger.error(
          `failed to post artifact failure note: ${String(postError)}`,
        ),
      );
  }

  private async generate(job: Job<ArtifactGenerationJob>): Promise<string> {
    const { threadId, requesterUserId, title, brief } = job.data;
    const result = await this.agentRegistry.get(ARTIFACT_GENERATOR).generate({
      messages: [{ role: 'user', content: this.buildTask(title, brief) }],
    });
    if (result.finishReason === 'length')
      throw new Error('generator hit the output token limit');

    const html = extractHtmlDocument(result.text);
    if (!html) throw new Error('generator returned no HTML document');
    if (/\p{Surrogate}/u.test(html) || html.includes('\u0000'))
      throw new Error('generated HTML is not valid UTF-8 text');
    const sizeBytes = Buffer.byteLength(html, 'utf8');
    if (sizeBytes > MAX_HTML_BYTES)
      throw new Error(
        `generated HTML is ${sizeBytes} bytes, over the ${MAX_HTML_BYTES} byte cap`,
      );

    const { blocked, warnings } = this.artifactScannerService.scan(html);
    if (blocked.length > 0)
      throw new UnrecoverableError(this.describeFindings(blocked));
    if (warnings.length > 0)
      this.logger.warn(
        `job ${job.id} scan warnings: ${this.describeFindings(warnings)}`,
      );

    const artifactId = await this.artifactRepository.create(
      {
        title,
        slackThreadId: threadId,
        requestedBySlackUserId: requesterUserId,
      },
      {
        html,
        sha256: createHash('sha256').update(html).digest('hex'),
        sizeBytes,
        model: result.response.modelId,
        scanWarnings:
          warnings.length > 0
            ? warnings.map(({ type, line }) => ({ type, line }))
            : undefined,
      },
    );
    await job.updateData({ ...job.data, artifactId });
    this.logger.log(`saved artifact ${artifactId} (${sizeBytes} bytes)`);
    return artifactId;
  }

  private describeFindings(findings: ArtifactScanFinding[]): string {
    return [
      ...new Set(findings.map(({ type, line }) => `${type} at line ${line}`)),
    ].join(', ');
  }

  private buildTask(title: string, brief: string): string {
    return `Title: ${title}

Brief:
${brief}

Write the HTML page.`;
  }
}
