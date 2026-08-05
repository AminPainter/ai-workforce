import { z } from 'zod';

export const driftingChangeSchema = z.object({
  file: z.string().describe('Repo-relative path of the changed file.'),
  change: z
    .string()
    .describe(
      'What changed on the response contract (the renamed key, removed attribute, new enum value, retyped field, etc.).',
    ),
  consumer: z
    .string()
    .describe('Top consuming surface: /public, /api/int, /admin, or external.'),
  frontendImpact: z
    .enum(['breaking', 'silent', 'unverified', 'unverifiable-external'])
    .describe(
      'Verified severity. breaking = a wired zod field throws. silent = no throw AND a located read site mis-behaves on the value. unverified = consumer not found; kept at backend hypothesis. unverifiable-external = S2S/webhook, no glomopay-checkout consumer. A loose/renamed field with no located read site is NOT a drifting change — omit it (it belongs in ruledOut), never emit it as silent.',
    ),
  frontendEvidence: z
    .string()
    .describe(
      'glomopay-checkout evidence that decided it: the schema path+line for breaking, the READ SITE file:line for silent, "no schema wired (TS cast)", or "not found; searched <terms>" for unverified.',
    ),
  reason: z
    .string()
    .describe(
      'One short sentence tying the backend change to the frontend evidence (e.g. "renames `settled_at` -> `finalized_at`; order.schema.ts:41 requires `settledAt` so safeParse throws").',
    ),
});

export const contractDriftReportSchema = z.object({
  hasContractDrift: z
    .boolean()
    .describe(
      'true iff driftingChanges is non-empty after verification — at least one finding survives as breaking, silent (with a located read site), unverified, or unverifiable-external. Additive-only, not-consumed, and declared-but-never-read findings do NOT set this true.',
    ),
  summary: z
    .string()
    .describe(
      '1-3 sentences naming the drift-causing changes in plain language. If nothing drifts, state what was checked and why it is safe.',
    ),
  driftingChanges: z
    .array(driftingChangeSchema)
    .describe(
      'One entry per drift-causing change, ordered by consumer priority then breaking before potentially-breaking. Empty array when hasContractDrift is false.',
    ),
});

export type DriftingChange = z.infer<typeof driftingChangeSchema>;
export type ContractDriftReport = z.infer<typeof contractDriftReportSchema>;
