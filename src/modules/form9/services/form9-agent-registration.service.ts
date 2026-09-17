import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AiService } from '../../ai/services/ai.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  FORM9_CLASSIFIER,
  createForm9Classifier,
} from '../agent/form9-classifier.agent';

@Injectable()
export class Form9AgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      FORM9_CLASSIFIER,
      createForm9Classifier(this.aiService),
    );
  }
}
