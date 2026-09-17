import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { FORM9_CLASSIFIER_SYSTEM_PROMPT } from './form9-classifier.prompt';
import { form9ClassificationSchema } from './form9-classifier.schema';

export const FORM9_CLASSIFIER = 'form9-classifier';

export function createForm9Classifier(aiService: AiService): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: FORM9_CLASSIFIER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: form9ClassificationSchema }),
  });
}
