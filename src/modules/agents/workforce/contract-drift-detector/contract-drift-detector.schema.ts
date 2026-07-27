import { z } from 'zod';

export const driftingChangeSchema = z.object({
  file: z.string().describe('Repo-relative path of the changed file.'),
  change: z
    .string()
    .describe(
      'What changed on the response contract (the renamed key, removed attribute, new enum value, retyped field, etc.).',
    ),
  reason: z
    .string()
    .describe(
      'One short sentence on WHY it breaks strict zod (e.g. "renames the `settled_at` key so the zod field no longer matches").',
    ),
});

export const contractDriftReportSchema = z.object({
  hasContractDrift: z
    .boolean()
    .describe(
      'true if any change in the diff can drift a response contract, else false.',
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
