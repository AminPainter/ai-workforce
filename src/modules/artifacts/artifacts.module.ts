import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { SlackModule } from '../slack/slack.module.js';
import { ArtifactsController } from './controllers/artifacts.controller.js';
import { ArtifactRequestService } from './services/artifact-request.service.js';
import { ArtifactScannerService } from './services/artifact-scanner.service.js';
import { ArtifactRepository } from './services/artifact.repository.js';
import { ArtifactGeneratorAgentRegistrationService } from './services/artifact-generator-agent-registration.service.js';
import { ArtifactGenerationProcessor } from './processors/artifact-generation.processor.js';
import { ARTIFACT_GENERATION_QUEUE } from './queues/artifact.queue.js';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    SlackModule,
    BullModule.registerQueue({ name: ARTIFACT_GENERATION_QUEUE }),
  ],
  controllers: [ArtifactsController],
  providers: [
    ArtifactRequestService,
    ArtifactScannerService,
    ArtifactRepository,
    ArtifactGeneratorAgentRegistrationService,
    ArtifactGenerationProcessor,
  ],
  exports: [ArtifactRequestService, ArtifactScannerService],
})
export class ArtifactsModule {}
