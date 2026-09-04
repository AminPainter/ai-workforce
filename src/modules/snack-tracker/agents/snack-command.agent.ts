import { ToolLoopAgent, stepCountIs, Output } from 'ai';
import { AiService } from '../../ai/services/ai.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { SNACK_COMMAND_SYSTEM_PROMPT } from './snack-command.prompt';
import { snackCommandSchema } from './snack-command.schema';

export const SNACK_COMMAND = 'snack-command';

export function createSnackCommand(aiService: AiService): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: SNACK_COMMAND_SYSTEM_PROMPT,
    tools: {},
    stopWhen: stepCountIs(1),
    output: Output.object({ schema: snackCommandSchema }),
  });
}
