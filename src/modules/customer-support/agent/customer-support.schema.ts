import { z } from 'zod';

export const customerSupportDraftSchema = z.object({
  isSupportRequest: z
    .boolean()
    .describe(
      'True only if the newest customer message is a genuine GlomoPay customer-support request. False for spam, marketing or sales pitches, phishing, credential-harvesting, unrelated or random queries, automated/no-reply notifications, gibberish, or test messages.',
    ),
  customerReply: z
    .string()
    .describe(
      'The complete draft reply, written for the customer, as plain text with no HTML or markdown. This is the only field a support agent can copy and paste. It must be customer-facing: no internal system names, code, IDs, engineer names, or unmasked PII. Leave empty when isSupportRequest is false.',
    ),
  triageReason: z
    .string()
    .describe(
      'When isSupportRequest is false, one short internal sentence saying why this is not a legitimate support request (e.g. "phishing attempt asking for login credentials", "marketing spam"). Leave empty when isSupportRequest is true.',
    ),
});
