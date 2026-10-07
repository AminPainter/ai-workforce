import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { LEAVE_REQUEST_CLASSIFIER_SYSTEM_PROMPT } from './leave-request-classifier.prompt';
import { leaveRequestClassificationSchema } from './leave-request-classifier.schema';

export const LEAVE_REQUEST_CLASSIFIER = 'leave-request-classifier';

export function createLeaveRequestClassifier(
  aiService: AiService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: LEAVE_REQUEST_CLASSIFIER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: leaveRequestClassificationSchema }),
  });
}
