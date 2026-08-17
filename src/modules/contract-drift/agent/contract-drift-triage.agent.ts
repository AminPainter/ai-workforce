import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { CONTRACT_DRIFT_TRIAGE_SYSTEM_PROMPT } from './contract-drift-triage.prompt';
import { triageResultSchema } from './contract-drift-triage.schema';

// Stage 1 of the contract-drift pipeline: one fresh-context call per PR that enumerates every
// in-scope wire-contract candidate. It does NOT decide breaking — the verifier stage does.
export const CONTRACT_DRIFT_TRIAGE = 'contract-drift-triage';

export function createContractDriftTriage(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CONTRACT_DRIFT_TRIAGE_SYSTEM_PROMPT,
    tools: { ...gitHubMcpService.getTools() },
    stopWhen: stepCountIs(
      Number(configService.get('CONTRACT_DRIFT_TRIAGE_MAX_STEPS') ?? 50),
    ),
    output: Output.object({ schema: triageResultSchema }),
  });
}
