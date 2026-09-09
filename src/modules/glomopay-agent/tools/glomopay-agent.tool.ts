import { tool } from 'ai';
import { z } from 'zod';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { GLOMOPAY_AGENT } from '../agent/glomopay-agent.agent';

export function createGlomopayAgentTool(agentRegistry: AgentRegistry) {
  return tool({
    description:
      'Delegate to the GlomoPay systems agent for anything that needs live data from GlomoPay\'s REST API — the state of payments, payouts, refunds, settlements, orders, payment links, subscriptions, virtual accounts, balances, FX rates and quotes, customers, beneficiaries, merchants, KYC links, documents, and RFIs. Reach for it when the question is about what is happening right now in GlomoPay\'s own systems, not how the product is built (that is GitHub) or how it fails (that is Sentry). It can both read and act — look things up, and create, update, cancel, or convert against GlomoPay\'s staging API. Examples: "what\'s the status of payout X", "is virtual account Y active", "what\'s the USD balance", "create a test payout of $100 to beneficiary Z". Describe the task in plain language and include every identifier the agent needs. It returns a short factual summary with PANs, account numbers, and emails already masked.',
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
