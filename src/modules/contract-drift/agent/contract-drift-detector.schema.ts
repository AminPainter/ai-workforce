import { z } from 'zod';

export const breakingChangeSchema = z.object({
  file: z
    .string()
    .describe('Repo-relative path of the changed glomopay_service file.'),
  change: z
    .string()
    .describe(
      'What changed on the response contract (the renamed key, removed attribute, new/renamed enum value, retyped field, etc.).',
    ),
  evidence: z
    .string()
    .describe(
      'The concrete glomopay-checkout artifact you FETCHED that proves the break: the schema file path + line whose zod field rejects the new value (e.g. "apps/merchant-dashboard/src/features/orders/schemas/order.schema.ts:41 requires `settledAt`"), or the read-site file:line whose logic mis-behaves on it. Must reference a real path you opened via get_file_contents / search_code — never "need to verify" or any deferral to a human.',
    ),
  reason: z
    .string()
    .describe(
      'One short sentence: the endpoint/consumer, and why this change breaks it.',
    ),
});

export const contractDriftReportSchema = z.object({
  hasBreakingChange: z
    .boolean()
    .describe(
      'true only if breakingChanges is non-empty — at least one change was confirmed against glomopay-checkout to break the frontend. Anything you could not confirm as breaking is false.',
    ),
  summary: z
    .string()
    .describe(
      '1-3 sentences. If breaking: name the confirmed breaks and the glomopay-checkout evidence for each. If not: state what you fetched in both repos and why it is safe.',
    ),
  breakingChanges: z
    .array(breakingChangeSchema)
    .describe(
      'One entry per CONFIRMED breaking change. Empty array when hasBreakingChange is false.',
    ),
});

export type BreakingChange = z.infer<typeof breakingChangeSchema>;
export type ContractDriftReport = z.infer<typeof contractDriftReportSchema>;
