import { createHash } from 'crypto';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { SlackBotService } from '../../slack/services/slack-bot.service.js';
import {
  ARTIFACT_PUBLISH_QUEUE,
  type ArtifactPublishJob,
} from '../queues/artifact.queue.js';
import {
  ArtifactRepository,
  type PublishedArtifact,
} from '../services/artifact.repository.js';

@Processor(ARTIFACT_PUBLISH_QUEUE)
export class ArtifactPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(ArtifactPublishProcessor.name);
  private readonly serviceUrl: string;

  constructor(
    private readonly artifactRepository: ArtifactRepository,
    private readonly slackBotService: SlackBotService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.serviceUrl = this.configService
      .getOrThrow<string>('SERVICE_URL')
      .replace(/\/+$/, '');
  }

  async process(job: Job<ArtifactPublishJob>): Promise<void> {
    const { artifactId, version } =
      job.data.published ?? (await this.save(job));
    const url = `${this.serviceUrl}/artifacts/${artifactId}`;
    await this.slackBotService.postToThread(
      job.data.threadId,
      version === 1
        ? `${job.data.title}: ${url}`
        : `${job.data.title} (updated, v${version}): ${url}`,
    );
    this.logger.log(
      `posted artifact ${artifactId} v${version} to thread ${job.data.threadId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ArtifactPublishJob>, error: Error): Promise<void> {
    this.logger.error(`job ${job.id} failed: ${error.message}`);
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await this.slackBotService
      .postToThread(
        job.data.threadId,
        `I couldn't publish "${job.data.title}". Ask me again to retry.`,
      )
      .catch((postError: unknown) =>
        this.logger.error(
          `failed to post artifact failure note: ${String(postError)}`,
        ),
      );
  }

  private async save(job: Job<ArtifactPublishJob>): Promise<PublishedArtifact> {
    const { threadId, requesterUserId, title, html, model } = job.data;
    const published = await this.artifactRepository.publish(
      {
        title,
        slackThreadId: threadId,
        requestedBySlackUserId: requesterUserId,
      },
      {
        html,
        sha256: createHash('sha256').update(html).digest('hex'),
        sizeBytes: Buffer.byteLength(html, 'utf8'),
        model,
      },
    );
    await job.updateData({ ...job.data, published });
    this.logger.log(
      `saved artifact ${published.artifactId} v${published.version}`,
    );
    return published;
  }
}
