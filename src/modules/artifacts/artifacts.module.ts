import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SlackModule } from '../slack/slack.module.js';
import { ArtifactRequestService } from './services/artifact-request.service.js';
import { ArtifactRepository } from './services/artifact.repository.js';
import { ArtifactPublishProcessor } from './processors/artifact-publish.processor.js';
import {
  ARTIFACT_BUILD_QUEUE,
  ARTIFACT_PUBLISH_QUEUE,
} from './queues/artifact.queue.js';

@Module({
  imports: [
    SlackModule,
    BullModule.registerQueue(
      { name: ARTIFACT_BUILD_QUEUE },
      { name: ARTIFACT_PUBLISH_QUEUE },
    ),
  ],
  // TODO: register ArtifactsController to serve /artifacts/:id again once authentication is in place.
  controllers: [],
  providers: [
    ArtifactRequestService,
    ArtifactRepository,
    ArtifactPublishProcessor,
  ],
  exports: [ArtifactRequestService],
})
export class ArtifactsModule {}
