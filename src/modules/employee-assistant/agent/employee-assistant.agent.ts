import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service.js';
import { GitHubMcpService } from '../../ai/services/github-mcp.service.js';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service.js';
import { AlloyDbMcpService } from '../../ai/services/alloydb-mcp.service.js';
import { SkillsService } from '../../skills/services/skills.service.js';
import { SnacksLedgerService } from '../../snack-tracker/services/snacks-ledger.service.js';
import { createSnacksLedgerTool } from '../../snack-tracker/tools/snacks-ledger.tool.js';
import { createMarkSnacksFulfilledTool } from '../../snack-tracker/tools/mark-snacks-fulfilled.tool.js';
import { SnackTool } from '../../snack-tracker/constants/snack-tools.js';
import { CodingTaskService } from '../../coding-agent/services/coding-task.service.js';
import { createDelegateCodingTaskTool } from '../../coding-agent/tools/delegate-coding-task.tool.js';
import { CodingAgentTool } from '../../coding-agent/constants/coding-agent-tools.js';
import { RegisteredAgent } from '../../agents/services/agent-registry.service.js';
import { EMPLOYEE_ASSISTANT_SYSTEM_PROMPT } from './employee-assistant.prompt.js';

export const EMPLOYEE_ASSISTANT = 'employee-assistant';

const MAX_STEPS = 40;

const FINAL_STEP_INSTRUCTIONS =
  'You reached the tool-call limit for this request. Answer now with what you found. Say what you could not check.';

export function createEmployeeAssistant(
  aiService: AiService,
  sentryMcpService: SentryMcpService,
  gitHubMcpService: GitHubMcpService,
  atlassianMcpService: AtlassianMcpService,
  alloyDbMcpService: AlloyDbMcpService,
  skillsService: SkillsService,
  snacksLedgerService: SnacksLedgerService,
  configService: ConfigService,
  codingTaskService: CodingTaskService,
): RegisteredAgent {
  const skills = skillsService.buildAgentSkills([
    resolve(import.meta.dirname, '../skills/sentry-root-cause'),
  ]);

  const bakarChannelId = `slack:${configService.getOrThrow<string>(
    'BAKAR_SLACK_CHANNEL',
  )}`;

  const model =
    configService.get<AiModel>('EMPLOYEE_ASSISTANT_MODEL') || AiModel.GROK_4_7;

  const instructions = `${EMPLOYEE_ASSISTANT_SYSTEM_PROMPT}\n\n${skills.promptSection}`;

  return new ToolLoopAgent({
    model: aiService.model(model),
    instructions,
    tools: {
      ...aiService.webTools(),
      ...sentryMcpService.getTools(),
      ...gitHubMcpService.getTools(),
      ...atlassianMcpService.getTools(),
      ...alloyDbMcpService.getTools(),
      ...skills.tools,
      [SnackTool.SNACKS_LEDGER]: createSnacksLedgerTool(snacksLedgerService),
      [SnackTool.MARK_SNACKS_FULFILLED]: createMarkSnacksFulfilledTool(
        snacksLedgerService,
        bakarChannelId,
      ),
      [CodingAgentTool.DELEGATE_CODING_TASK]:
        createDelegateCodingTaskTool(codingTaskService),
    },
    stopWhen: stepCountIs(MAX_STEPS),
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === MAX_STEPS - 1)
        return {
          toolChoice: 'none',
          instructions: `${instructions}\n\n${FINAL_STEP_INSTRUCTIONS}`,
        };
    },
    toolsContext: {
      [SnackTool.MARK_SNACKS_FULFILLED]: { channelId: '', requesterUserId: '' },
      [CodingAgentTool.DELEGATE_CODING_TASK]: { threadId: '' },
    },
  });
}
