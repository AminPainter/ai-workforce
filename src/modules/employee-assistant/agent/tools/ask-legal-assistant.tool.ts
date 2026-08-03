import { tool } from 'ai';
import { z } from 'zod';
import { AgentRegistry } from '../../../agents/services/agent-registry.service';
import { LEGAL_ASSISTANT } from '../../../legal-assistant/agent/legal-assistant.agent';

export function createAskLegalAssistantTool(agentRegistry: AgentRegistry) {
  return tool({
    description:
      "Ask the Legal Assistant a question about GlomoPay's internal LEGAL reference documents (contracts, policies, legal reference material). It answers grounded ONLY in those documents and cites source file + page. Use it for any question about what a legal document says; relay its cited answer. It returns \"I don't have that\" when the documents don't cover the question — take that at face value, don't fill the gap yourself.",
    inputSchema: z.object({
      question: z
        .string()
        .describe(
          'The self-contained legal-document question to answer, including any context needed to understand it.',
        ),
    }),
    execute: async ({ question }: { question: string }): Promise<string> => {
      const { text } = (await agentRegistry.get(LEGAL_ASSISTANT).generate({
        messages: [{ role: 'user', content: question }],
      })) as { text: string };
      return text;
    },
  });
}
