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
  escalate: z
    .boolean()
    .describe(
      'true when a human must handle this before any reply goes out — the request needs an action you cannot verify, touches money movement, KYC, or a regulator matter, or the intent is unclear.',
    ),
  escalateReason: z
    .string()
    .describe(
      'One short sentence for the human support agent explaining why you escalated. Internal only — never sent to the customer. Use "" when escalate is false.',
    ),
  internalNotes: z
    .string()
    .describe(
      'Optional short context for the support agent (what you checked, what you are unsure about). Internal only — never sent to the customer. Use "" if none.',
    ),
});

export type CustomerSupportDraft = z.infer<typeof customerSupportDraftSchema>;
