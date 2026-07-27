import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../ai/services/ai.service';
import { GitHubMcpService } from '../../../ai/services/github-mcp.service';
import { RegisteredAgent } from '../../services/agent-registry.service';
import { CONTRACT_DRIFT_DETECTOR_SYSTEM_PROMPT } from './contract-drift-detector.prompt';
import { contractDriftReportSchema } from './contract-drift-detector.schema';

// One agent that tool-loops over the GitHub tools and emits the structured report on the
// final step — the response format is applied only once the loop stops, so the model
// fetches patch hunks before it answers.
export const CONTRACT_DRIFT_DETECTOR = 'contract-drift-detector';

export function createContractDriftDetector(
  aiService: AiService,
  gitHubMcpService: GitHubMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CONTRACT_DRIFT_DETECTOR_SYSTEM_PROMPT,
    tools: { ...gitHubMcpService.getTools() },
    stopWhen: stepCountIs(
      Number(configService.get('CONTRACT_DRIFT_MAX_STEPS') ?? 30),
    ),
    output: Output.object({ schema: contractDriftReportSchema }),
  });
}
