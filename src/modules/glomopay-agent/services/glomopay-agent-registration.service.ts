import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AiService } from '../../ai/services/ai.service';
import { GlomopayMcpService } from '../../ai/services/glomopay-mcp.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  GLOMOPAY_AGENT,
  createGlomopayAgent,
} from '../agent/glomopay-agent.agent';

@Injectable()
export class GlomopayAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly glomopayMcpService: GlomopayMcpService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      GLOMOPAY_AGENT,
      createGlomopayAgent(this.aiService, this.glomopayMcpService),
    );
  }
}
