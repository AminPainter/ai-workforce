import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { RegisteredAgent } from '../../agents/services/agent-registry.service.js';
import { ARTIFACT_GENERATOR_SYSTEM_PROMPT } from './artifact-generator.prompt.js';

export const ARTIFACT_GENERATOR = 'artifact-generator';

const MAX_OUTPUT_TOKENS = 32_000;

export function createArtifactGenerator(
  aiService: AiService,
  configService: ConfigService,
): RegisteredAgent {
  const model =
    configService.get<AiModel>('ARTIFACT_GENERATOR_MODEL') ||
    AiModel.CLAUDE_OPUS_5_5;

  return new ToolLoopAgent({
    model: aiService.model(model),
    instructions: ARTIFACT_GENERATOR_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
}
