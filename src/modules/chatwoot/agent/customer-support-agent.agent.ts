import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { CUSTOMER_SUPPORT_AGENT_SYSTEM_PROMPT } from './customer-support-agent.prompt';

export const CUSTOMER_SUPPORT_AGENT = 'customer-support-agent';

export function createCustomerSupportAgent(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  sentryMcpService: SentryMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CUSTOMER_SUPPORT_AGENT_SYSTEM_PROMPT,
    tools: {
      ...aiService.webTools(),
      ...gitHubMcpService.getTools(),
      ...sentryMcpService.getTools(),
    },
    stopWhen: stepCountIs(
      Number(configService.get('CHATWOOT_MAX_STEPS') ?? 40),
    ),
  });
}
