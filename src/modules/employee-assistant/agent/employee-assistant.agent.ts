import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AtlassianMcpService } from '../../ai/services/atlassian-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT_SYSTEM_PROMPT } from './employee-assistant.prompt';

export const EMPLOYEE_ASSISTANT = 'employee-assistant';

export function createEmployeeAssistant(
  aiService: AiService,
  sentryMcpService: SentryMcpService,
  gitHubMcpService: GitHubMcpService,
  atlassianMcpService: AtlassianMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: EMPLOYEE_ASSISTANT_SYSTEM_PROMPT,
    tools: {
      ...aiService.webTools(),
      ...sentryMcpService.getTools(),
      ...gitHubMcpService.getTools(),
      ...atlassianMcpService.getTools(),
    },
    stopWhen: stepCountIs(
      Number(configService.get('EMPLOYEE_ASSISTANT_MAX_STEPS') ?? 40),
    ),
  });
}
