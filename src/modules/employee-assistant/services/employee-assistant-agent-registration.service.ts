import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service.js';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service.js';
import { GitHubMcpService } from '../../ai/services/github-mcp.service.js';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service.js';
import { AlloyDbMcpService } from '../../ai/services/alloydb-mcp.service.js';
import { SkillsService } from '../../skills/services/skills.service.js';
import { SnacksLedgerService } from '../../snack-tracker/services/snacks-ledger.service.js';
import { AgentRegistry } from '../../agents/services/agent-registry.service.js';
import { CodingTaskService } from '../../coding-agent/services/coding-task.service.js';
import {
  EMPLOYEE_ASSISTANT,
  createEmployeeAssistant,
} from '../agent/employee-assistant.agent.js';

@Injectable()
export class EmployeeAssistantAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly sentryMcpService: SentryMcpService,
    private readonly gitHubMcpService: GitHubMcpService,
    private readonly atlassianMcpService: AtlassianMcpService,
    private readonly alloyDbMcpService: AlloyDbMcpService,
    private readonly skillsService: SkillsService,
    private readonly snacksLedgerService: SnacksLedgerService,
    private readonly configService: ConfigService,
    private readonly agentRegistry: AgentRegistry,
    private readonly codingTaskService: CodingTaskService,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      EMPLOYEE_ASSISTANT,
      createEmployeeAssistant(
        this.aiService,
        this.sentryMcpService,
        this.gitHubMcpService,
        this.atlassianMcpService,
        this.alloyDbMcpService,
        this.skillsService,
        this.snacksLedgerService,
        this.configService,
        this.codingTaskService,
      ),
    );
  }
}
