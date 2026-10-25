import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { RegisteredAgent } from '../../agents/services/agent-registry.service.js';
import { FORM9_CLASSIFIER_SYSTEM_PROMPT } from './form9-classifier.prompt.js';
import { form9TaxonomySchema } from './form9-classifier.schema.js';

export const FORM9_CLASSIFIER = 'form9-classifier';

export function createForm9Classifier(aiService: AiService): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(AiModel.CLAUDE_HAIKU_4_5),
    instructions: FORM9_CLASSIFIER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: form9TaxonomySchema }),
  });
}
