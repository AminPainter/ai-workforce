import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  EMPLOYEE_ASSISTANT,
  createEmployeeAssistant,
} from '../agent/employee-assistant.agent';

@Injectable()
export class EmployeeAssistantAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly sentryMcpService: SentryMcpService,
    private readonly gitHubMcpService: GitHubMcpService,
    private readonly atlassianMcpService: AtlassianMcpService,
    private readonly configService: ConfigService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      EMPLOYEE_ASSISTANT,
      createEmployeeAssistant(
        this.aiService,
        this.sentryMcpService,
        this.gitHubMcpService,
        this.atlassianMcpService,
        this.configService,
      ),
    );
  }
}
