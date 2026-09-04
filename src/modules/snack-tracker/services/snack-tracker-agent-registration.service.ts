import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AiService } from '../../ai/services/ai.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  SNACKS_PLEDGE_CLASSIFIER,
  createSnacksPledgeClassifier,
} from '../agents/snacks-pledge-classifier.agent';
import {
  SNACK_COMMAND,
  createSnackCommand,
} from '../agents/snack-command.agent';

@Injectable()
export class SnackTrackerAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      SNACKS_PLEDGE_CLASSIFIER,
      createSnacksPledgeClassifier(this.aiService),
    );
    this.agentRegistry.register(
      SNACK_COMMAND,
      createSnackCommand(this.aiService),
    );
  }
}
