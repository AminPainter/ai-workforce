import { z } from 'zod';

export const draftSanitizerSchema = z.object({
  safe: z
    .boolean()
    .describe(
      'true only if the draft is fully customer-safe: no internal system names, code, IDs, engineer names, infra detail, or unmasked PII.',
    ),
  violations: z
    .array(z.string())
    .describe(
      'One short entry per problem found in the original draft. Empty array if none.',
    ),
  revisedDraft: z
    .string()
    .describe(
      'The draft rewritten to remove every violation while keeping the customer-facing meaning and tone. If the draft was already safe, return it unchanged.',
    ),
});

export type DraftSanitizerResult = z.infer<typeof draftSanitizerSchema>;
