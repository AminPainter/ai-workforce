import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { CUSTOMER_SUPPORT_SYSTEM_PROMPT } from './customer-support.prompt';
import { customerSupportDraftSchema } from './customer-support.schema';

export const CUSTOMER_SUPPORT = 'customer-support';

export function createCustomerSupport(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  sentryMcpService: SentryMcpService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CUSTOMER_SUPPORT_SYSTEM_PROMPT,
    tools: {
      ...aiService.webTools(),
      ...gitHubMcpService.getTools(),
      ...sentryMcpService.getTools(),
    },
    stopWhen: stepCountIs(30),
    output: Output.object({ schema: customerSupportDraftSchema }),
  });
}
