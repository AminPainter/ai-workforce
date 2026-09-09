import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { DRAFT_SANITIZER_SYSTEM_PROMPT } from './draft-sanitizer.prompt';
import { draftSanitizerSchema } from './draft-sanitizer.schema';

export const DRAFT_SANITIZER = 'draft-sanitizer';

export function createDraftSanitizer(aiService: AiService): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: DRAFT_SANITIZER_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: draftSanitizerSchema }),
  });
}
