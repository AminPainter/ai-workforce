import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { CONTRACT_DRIFT_VERIFIER_SYSTEM_PROMPT } from './contract-drift-verifier.prompt';
import { verifierVerdictSchema } from './contract-drift-verifier.schema';

// Stage 2 of the contract-drift pipeline: one fresh-context call per candidate that confirms or
// clears it against glomopay-checkout. The processor fans these out with bounded concurrency.
export const CONTRACT_DRIFT_VERIFIER = 'contract-drift-verifier';

export function createContractDriftVerifier(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CONTRACT_DRIFT_VERIFIER_SYSTEM_PROMPT,
    tools: { ...gitHubMcpService.getTools() },
    stopWhen: stepCountIs(
      Number(configService.get('CONTRACT_DRIFT_VERIFY_MAX_STEPS') ?? 50),
    ),
    output: Output.object({ schema: verifierVerdictSchema }),
  });
}
