import { ToolLoopAgent, stepCountIs } from 'ai';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { GitHubMcpService } from '../../ai/services/github-mcp.service.js';
import { SentryMcpService } from '../../ai/services/sentry-mcp.service.js';
import { AlloyDbMcpService } from '../../ai/services/alloydb-mcp.service.js';
import { RegisteredAgent } from '../../agents/services/agent-registry.service.js';
import { CUSTOMER_SUPPORT_SYSTEM_PROMPT } from './customer-support.prompt.js';

export const CUSTOMER_SUPPORT = 'customer-support';

export function createCustomerSupport(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  sentryMcpService: SentryMcpService,
  alloyDbMcpService: AlloyDbMcpService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(AiModel.GLM_5_2),
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
