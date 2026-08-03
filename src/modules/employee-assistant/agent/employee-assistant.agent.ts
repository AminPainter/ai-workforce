import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';
import { AiService } from '../../ai/services/ai.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service';
import { GlomopayMcpService } from '../../ai/services/glomopay-mcp.service';
import { SkillsService } from '../../skills/services/skills.service';
import {
  AgentRegistry,
  RegisteredAgent,
} from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT_SYSTEM_PROMPT } from './employee-assistant.prompt';
import { createAskLegalAssistantTool } from './tools/ask-legal-assistant.tool';

export const EMPLOYEE_ASSISTANT = 'employee-assistant';

export function createEmployeeAssistant(
  aiService: AiService,
  sentryMcpService: SentryMcpService,
  gitHubMcpService: GitHubMcpService,
  atlassianMcpService: AtlassianMcpService,
  glomopayMcpService: GlomopayMcpService,
  skillsService: SkillsService,
  configService: ConfigService,
  agentRegistry: AgentRegistry,
): RegisteredAgent {
  const skills = skillsService.buildAgentSkills([
    resolve(__dirname, '../skills/sentry-root-cause'),
  ]);

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
      askLegalAssistant: createAskLegalAssistantTool(agentRegistry),
    },
    stopWhen: stepCountIs(
      Number(configService.get('EMPLOYEE_ASSISTANT_MAX_STEPS') ?? 40),
    ),
  });
}
