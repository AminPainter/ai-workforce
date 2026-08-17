import { z } from 'zod';

export const verifierVerdictSchema = z.object({
  verdict: z
    .enum(['breaking', 'cleared'])
    .describe(
      '"breaking" only if you opened consumer code in glomopay-checkout main that breaks on this change — a wired zod field that rejects the new shape/value (safeParse/.parse throws), or a located read site that genuinely mis-behaves in a user-visible way. "cleared" for everything else: no consumer, loose parse (z.string()/optional/no schema), declared-but-never-read, or out of scope.',
    ),
  evidence: z
    .string()
    .describe(
      'The concrete glomopay-checkout artifact you FETCHED: the schema file path + line whose zod field rejects the new value (e.g. "apps/merchant-dashboard/src/features/orders/schemas/order.schema.ts:41 requires `settledAt`"), or the read-site file:line whose logic mis-behaves on it. When cleared, name what you searched and opened that proves it is safe (the loose schema, the missing read site, the no-schema call). Must reference a real path you opened via get_file_contents / search_code — never "need to verify" or any deferral.',
    ),
  reason: z
    .string()
    .describe(
      'One short sentence: the endpoint/consumer, and why this change breaks it (verdict "breaking") or why it is safe (verdict "cleared").',
    ),
});

export type VerifierVerdict = z.infer<typeof verifierVerdictSchema>;
