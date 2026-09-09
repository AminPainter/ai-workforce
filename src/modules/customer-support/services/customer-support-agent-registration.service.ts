import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  CUSTOMER_SUPPORT,
  createCustomerSupport,
} from '../agent/customer-support.agent';

@Injectable()
export class CustomerSupportAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly gitHubMcpService: GitHubMcpService,
    private readonly sentryMcpService: SentryMcpService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      CUSTOMER_SUPPORT,
      createCustomerSupport(
        this.aiService,
        this.gitHubMcpService,
        this.sentryMcpService,
      ),
    );
  }
}
