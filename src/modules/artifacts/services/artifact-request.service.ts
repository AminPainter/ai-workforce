import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ARTIFACT_BUILD_QUEUE,
  type ArtifactBuildJob,
} from '../queues/artifact.queue.js';
import { ArtifactRepository } from './artifact.repository.js';

const BUILD_ATTEMPTS = 2;

export type ArtifactRequest = Omit<ArtifactBuildJob, 'baseHtml'>;

@Injectable()
export class ArtifactRequestService {
  private readonly logger = new Logger(ArtifactRequestService.name);

  constructor(
    @InjectQueue(ARTIFACT_BUILD_QUEUE)
    private readonly artifactBuildQueue: Queue<ArtifactBuildJob>,
    private readonly artifactRepository: ArtifactRepository,
  ) {}

  async request(
    artifactRequest: ArtifactRequest,
  ): Promise<{ revising: boolean }> {
    const baseHtml = await this.artifactRepository.findLatestHtmlInThread(
      artifactRequest.threadId,
    );
    const { id } = await this.artifactBuildQueue.add(
      'build',
      { ...artifactRequest, baseHtml },
      { attempts: BUILD_ATTEMPTS },
    );
    this.logger.log(
      `queued artifact ${baseHtml ? 'revision' : 'build'} job ${id} (thread ${artifactRequest.threadId})`,
    );
    return { revising: baseHtml !== undefined };
  }
}
