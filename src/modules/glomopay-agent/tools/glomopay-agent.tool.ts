import { tool } from 'ai';
import { z } from 'zod';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { GLOMOPAY_AGENT } from '../agent/glomopay-agent.agent';

export function createGlomopayAgentTool(agentRegistry: AgentRegistry) {
  return tool({
    description:
      'Delegate to the GlomoPay systems agent for anything that needs live data from GlomoPay\'s own systems — account, transaction, and product state that is not in the code and not in Sentry. Reach for it when the question is about what is happening right now (e.g. "what\'s the status of transfer X", "is account Y active", "what\'s the balance on Z"). Describe the task in plain language and include every identifier the agent needs. It returns a short factual summary with PANs, account numbers, and emails already masked.',
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          'The task for the GlomoPay systems agent, in plain language, with all identifiers it needs (transfer id, account id, etc.).',
        ),
    }),
    execute: async ({ task }: { task: string }): Promise<string> => {
      const { text } = (await agentRegistry.get(GLOMOPAY_AGENT).generate({
        messages: [{ role: 'user', content: task }],
      })) as { text: string };
      return text;
    },
  });
}
