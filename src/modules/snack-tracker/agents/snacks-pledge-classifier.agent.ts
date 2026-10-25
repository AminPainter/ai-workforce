import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { RegisteredAgent } from '../../agents/services/agent-registry.service.js';
import { SNACKS_PLEDGE_CLASSIFIER_SYSTEM_PROMPT } from './snacks-pledge-classifier.prompt.js';
import { snacksPledgeClassificationSchema } from './snacks-pledge-classifier.schema.js';

export const SNACKS_PLEDGE_CLASSIFIER = 'snacks-pledge-classifier';

export function createSnacksPledgeClassifier(
  aiService: AiService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(AiModel.GLM_5_2),
    instructions: SNACKS_PLEDGE_CLASSIFIER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: snacksPledgeClassificationSchema }),
  });
}
