import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { AiService } from '../../ai/services/ai.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service';
import { SkillsService } from '../../skills/services/skills.service';
import { SnacksLedgerService } from '../../snack-tracker/services/snacks-ledger.service';
import { createSnacksLedgerTool } from '../../snack-tracker/tools/snacks-ledger.tool';
import { createMarkSnacksFulfilledTool } from '../../snack-tracker/tools/mark-snacks-fulfilled.tool';
import {
  AgentRegistry,
  RegisteredAgent,
} from '../../agents/services/agent-registry.service';
import { createGlomopayAgentTool } from '../../glomopay-agent/tools/glomopay-agent.tool';
import { EMPLOYEE_ASSISTANT_SYSTEM_PROMPT } from './employee-assistant.prompt';

export const EMPLOYEE_ASSISTANT = 'employee-assistant';

export function createEmployeeAssistant(
  aiService: AiService,
  sentryMcpService: SentryMcpService,
  gitHubMcpService: GitHubMcpService,
  atlassianMcpService: AtlassianMcpService,
  skillsService: SkillsService,
  snacksLedgerService: SnacksLedgerService,
  configService: ConfigService,
  agentRegistry: AgentRegistry,
): RegisteredAgent {
  const skills = skillsService.buildAgentSkills([
    resolve(__dirname, '../skills/sentry-root-cause'),
  ]);

  const bakarChannelId = `slack:${configService.getOrThrow<string>(
    'BAKAR_SLACK_CHANNEL',
  )}`;

  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: `${EMPLOYEE_ASSISTANT_SYSTEM_PROMPT}\n\n${skills.promptSection}`,
    tools: {
      ...aiService.webTools(),
      ...sentryMcpService.getTools(),
      ...gitHubMcpService.getTools(),
      ...atlassianMcpService.getTools(),
      ...skills.tools,
      glomopayAgent: createGlomopayAgentTool(agentRegistry),
      snacksLedger: createSnacksLedgerTool(snacksLedgerService),
      markSnacksFulfilled: createMarkSnacksFulfilledTool(
        snacksLedgerService,
        bakarChannelId,
      ),
    },
    stopWhen: stepCountIs(
      Number(configService.get('EMPLOYEE_ASSISTANT_MAX_STEPS') ?? 40),
    ),
    toolsContext: {
      markSnacksFulfilled: { channelId: '', requesterUserId: '' },
    },
  });
}
