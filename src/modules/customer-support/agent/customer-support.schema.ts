import { z } from 'zod';

export const customerSupportDraftSchema = z.object({
  customerReply: z
    .string()
    .describe(
      'The complete draft reply, written for the customer, as plain text with no HTML or markdown. This is the only field a support agent can copy and paste. It must be customer-facing: no internal system names, code, IDs, engineer names, or unmasked PII.',
    ),
});
