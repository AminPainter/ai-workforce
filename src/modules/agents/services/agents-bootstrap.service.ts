import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service';
import { AgentRegistry } from './agent-registry.service';
import {
  EMPLOYEE_ASSISTANT,
  createEmployeeAssistant,
} from '../workforce/employee-assistant/employee-assistant.agent';
import {
  CONTRACT_DRIFT_DETECTOR,
  CONTRACT_DRIFT_FORMATTER,
  createContractDriftDetector,
  createContractDriftFormatter,
} from '../workforce/contract-drift-detector/contract-drift-detector.agent';

@Injectable()
export class AgentsBootstrapService implements OnApplicationBootstrap {
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

    this.agentRegistry.register(
      CONTRACT_DRIFT_DETECTOR,
      createContractDriftDetector(
        this.aiService,
        this.gitHubMcpService,
        this.configService,
      ),
    );

    this.agentRegistry.register(
      CONTRACT_DRIFT_FORMATTER,
      createContractDriftFormatter(this.aiService),
    );
  }
}
