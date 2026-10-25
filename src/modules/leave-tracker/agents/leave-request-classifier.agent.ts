import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service.js';
import { AiModel } from '../../ai/constants/ai-models.js';
import { RegisteredAgent } from '../../agents/services/agent-registry.service.js';
import { LEAVE_REQUEST_CLASSIFIER_SYSTEM_PROMPT } from './leave-request-classifier.prompt.js';
import { leaveRequestClassificationSchema } from './leave-request-classifier.schema.js';

export const LEAVE_REQUEST_CLASSIFIER = 'leave-request-classifier';

export function createLeaveRequestClassifier(
  aiService: AiService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(AiModel.GLM_5_2),
    instructions: LEAVE_REQUEST_CLASSIFIER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: leaveRequestClassificationSchema }),
  });
}
