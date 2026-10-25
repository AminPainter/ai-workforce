import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AiService } from '../../ai/services/ai.service.js';
import { AgentRegistry } from '../../agents/services/agent-registry.service.js';
import {
  LEAVE_REQUEST_CLASSIFIER,
  createLeaveRequestClassifier,
} from '../agents/leave-request-classifier.agent.js';

@Injectable()
export class LeaveTrackerAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      LEAVE_REQUEST_CLASSIFIER,
      createLeaveRequestClassifier(this.aiService),
    );
  }
}
