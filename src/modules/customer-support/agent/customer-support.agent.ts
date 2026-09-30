import { ToolLoopAgent, stepCountIs } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service';
import { AlloyDbMcpService } from '../../ai/services/alloydb-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { CUSTOMER_SUPPORT_SYSTEM_PROMPT } from './customer-support.prompt';

export const CUSTOMER_SUPPORT = 'customer-support';

export function createCustomerSupport(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  sentryMcpService: SentryMcpService,
  alloyDbMcpService: AlloyDbMcpService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CUSTOMER_SUPPORT_SYSTEM_PROMPT,
    tools: {
      ...aiService.webTools(),
      ...gitHubMcpService.getTools(),
      ...sentryMcpService.getTools(),
      ...alloyDbMcpService.getTools(),
    },
    stopWhen: stepCountIs(30),
  });
}
