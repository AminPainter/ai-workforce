import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { AiService } from '../../ai/services/ai.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service';
import { GlomopayMcpService } from '../../ai/services/glomopay-mcp.service';
import { SkillsService } from '../../skills/services/skills.service';
import { SnacksLedgerService } from '../../snack-tracker/services/snacks-ledger.service';
import { createSnacksLedgerTool } from '../../snack-tracker/tools/snacks-ledger.tool';
import { createMarkSnacksFulfilledTool } from '../../snack-tracker/tools/mark-snacks-fulfilled.tool';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT_SYSTEM_PROMPT } from './employee-assistant.prompt';

export const EMPLOYEE_ASSISTANT = 'employee-assistant';

export function createEmployeeAssistant(
  aiService: AiService,
  sentryMcpService: SentryMcpService,
  gitHubMcpService: GitHubMcpService,
  atlassianMcpService: AtlassianMcpService,
  glomopayMcpService: GlomopayMcpService,
  skillsService: SkillsService,
  snacksLedgerService: SnacksLedgerService,
  configService: ConfigService,
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
      ...glomopayMcpService.getTools(),
      ...skills.tools,
      snacksLedger: createSnacksLedgerTool(snacksLedgerService),
      markSnacksFulfilled: createMarkSnacksFulfilledTool(
        snacksLedgerService,
        bakarChannelId,
      ),
    },
    stopWhen: stepCountIs(40),
    toolsContext: {
      markSnacksFulfilled: { channelId: '', requesterUserId: '' },
    },
  });
}
