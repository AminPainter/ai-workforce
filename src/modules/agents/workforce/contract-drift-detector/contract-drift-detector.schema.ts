import { z } from 'zod';

export const DRIFT_TYPES = [
  'enum-value-changed',
  'field-removed',
  'field-renamed',
  'field-added',
  'type-changed',
  'value-now-nullable',
  'field-now-conditional',
] as const;

export const DRIFT_SEVERITIES = ['breaking', 'potentially-breaking'] as const;

export const driftingChangeSchema = z.object({
  file: z.string().describe('Repo-relative path of the changed file.'),
  change: z
    .string()
    .describe(
      'What changed on the response contract (the renamed key, removed attribute, new enum value, retyped field, etc.).',
    ),
  driftType: z.enum(DRIFT_TYPES).describe('Category of contract drift.'),
  reason: z
    .string()
    .describe(
      'One short sentence on WHY it breaks strict zod (e.g. "renames the `settled_at` key so the zod field no longer matches").',
    ),
  affectedSurface: z
    .string()
    .describe(
      'Highest-priority consumer surface affected (Api::Public, Api::Internal, Api::External / webhook builders, Api::Admin); note the others if it feeds more than one.',
    ),
  severity: z
    .enum(DRIFT_SEVERITIES)
    .describe(
      'breaking for field-removed / field-renamed / type-changed / value-now-nullable / enum-value removed-or-renamed (and field-added under .strict()); potentially-breaking for field-added, field-now-conditional, enum-value added, and flag-gated changes.',
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
