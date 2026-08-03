import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  CUSTOMER_SUPPORT_AGENT,
  createCustomerSupportAgent,
} from '../agent/customer-support-agent.agent';

@Injectable()
export class CustomerSupportAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly gitHubMcpService: GitHubMcpService,
    private readonly sentryMcpService: SentryMcpService,
    private readonly configService: ConfigService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      CUSTOMER_SUPPORT_AGENT,
      createCustomerSupportAgent(
        this.aiService,
        this.gitHubMcpService,
        this.sentryMcpService,
        this.configService,
      ),
    );
  }
}
