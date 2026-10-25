import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ARTIFACT_GENERATION_QUEUE,
  type ArtifactGenerationJob,
} from '../queues/artifact.queue.js';

@Injectable()
export class ArtifactRequestService {
  private readonly logger = new Logger(ArtifactRequestService.name);

  constructor(
    @InjectQueue(ARTIFACT_GENERATION_QUEUE)
    private readonly artifactGenerationQueue: Queue<ArtifactGenerationJob>,
  ) {}

  async request(job: ArtifactGenerationJob): Promise<void> {
    const { id } = await this.artifactGenerationQueue.add('generate', job);
    this.logger.log(
      `queued artifact generation job ${id} (thread ${job.threadId})`,
    );
  }
}
