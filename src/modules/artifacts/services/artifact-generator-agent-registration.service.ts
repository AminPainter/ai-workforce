import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service.js';
import { AgentRegistry } from '../../agents/services/agent-registry.service.js';
import {
  ARTIFACT_GENERATOR,
  createArtifactGenerator,
} from '../agent/artifact-generator.agent.js';

@Injectable()
export class ArtifactGeneratorAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      ARTIFACT_GENERATOR,
      createArtifactGenerator(this.aiService, this.configService),
    );
  }
}
