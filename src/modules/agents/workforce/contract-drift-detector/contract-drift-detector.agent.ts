import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../ai/services/ai.service';
import { GitHubMcpService } from '../../../ai/services/github-mcp.service';
import { RegisteredAgent } from '../../services/agent-registry.service';
import { CONTRACT_DRIFT_DETECTOR_SYSTEM_PROMPT } from './contract-drift-detector.prompt';
import { CONTRACT_DRIFT_FORMATTER_SYSTEM_PROMPT } from './contract-drift-formatter.prompt';
import { contractDriftReportSchema } from './contract-drift-detector.schema';

// Two agents, because the gateway model can't tool-call and emit JSON-schema output in one
// loop (a forced responseFormat makes it answer before it fetches). The detector keeps the
// GitHub tools and produces free-text analysis; the formatter has no tools and structures
// that analysis via Output.object.
export const CONTRACT_DRIFT_DETECTOR = 'contract-drift-detector';
export const CONTRACT_DRIFT_FORMATTER = 'contract-drift-formatter';

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
  });
}

export function createContractDriftFormatter(
  aiService: AiService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: CONTRACT_DRIFT_FORMATTER_SYSTEM_PROMPT,
    stopWhen: stepCountIs(2),
    output: Output.object({ schema: contractDriftReportSchema }),
  });
}
