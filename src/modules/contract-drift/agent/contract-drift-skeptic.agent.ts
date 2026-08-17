import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { CONTRACT_DRIFT_SKEPTIC_SYSTEM_PROMPT } from './contract-drift-skeptic.prompt';
import { skepticVerdictSchema } from './contract-drift-skeptic.schema';

// Stage 3 of the contract-drift pipeline: an adversarial reviewer that independently tries to refute
// a confirmed-breaking candidate. The processor runs N votes per candidate and keeps it only if a
// majority did not refute.
export const CONTRACT_DRIFT_SKEPTIC = 'contract-drift-skeptic';

export function createContractDriftSkeptic(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CONTRACT_DRIFT_SKEPTIC_SYSTEM_PROMPT,
    tools: { ...gitHubMcpService.getTools() },
    stopWhen: stepCountIs(
      Number(configService.get('CONTRACT_DRIFT_SKEPTIC_MAX_STEPS') ?? 50),
    ),
    output: Output.object({ schema: skepticVerdictSchema }),
  });
}
