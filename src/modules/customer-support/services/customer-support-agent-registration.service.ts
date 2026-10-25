import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AiService } from '../../ai/services/ai.service.js';
import { GitHubMcpService } from '../../ai/services/github-mcp.service.js';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service.js';
import { AlloyDbMcpService } from '../../ai/services/alloydb-mcp.service.js';
import { WebToolsService } from '../../web/services/web-tools.service.js';
import { AgentRegistry } from '../../agents/services/agent-registry.service.js';
import {
  CUSTOMER_SUPPORT,
  createCustomerSupport,
} from '../agent/customer-support.agent.js';

@Injectable()
export class CustomerSupportAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly gitHubMcpService: GitHubMcpService,
    private readonly sentryMcpService: SentryMcpService,
    private readonly alloyDbMcpService: AlloyDbMcpService,
    private readonly webToolsService: WebToolsService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      CUSTOMER_SUPPORT,
      createCustomerSupport(
        this.aiService,
        this.gitHubMcpService,
        this.sentryMcpService,
        this.alloyDbMcpService,
        this.webToolsService,
      ),
    );
  }
}
