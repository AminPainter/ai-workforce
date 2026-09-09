import { z } from 'zod';

export const customerSupportDraftSchema = z.object({
  customerReply: z
    .string()
    .describe(
      'The complete draft reply, written for the customer. This is the only field a support agent can copy and paste. It must be customer-facing: no internal system names, code, IDs, engineer names, or unmasked PII.',
    ),
  contentType: z
    .enum(['html', 'plainText'])
    .describe('Format of customerReply. Use plainText unless HTML is needed.'),
  internalNotes: z
    .string()
    .describe(
      'Optional short context for the support agent (what you checked, what you are unsure about). Internal only — never sent to the customer. Use "" if none.',
    ),
});
