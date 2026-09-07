import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { SNACKS_PLEDGE_CLASSIFIER_SYSTEM_PROMPT } from './snacks-pledge-classifier.prompt';
import { snacksPledgeClassificationSchema } from './snacks-pledge-classifier.schema';

export const SNACKS_PLEDGE_CLASSIFIER = 'snacks-pledge-classifier';

export function createSnacksPledgeClassifier(
  aiService: AiService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: SNACKS_PLEDGE_CLASSIFIER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: snacksPledgeClassificationSchema }),
  });
}
