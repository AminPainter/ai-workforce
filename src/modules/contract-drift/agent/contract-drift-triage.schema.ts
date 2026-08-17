import { z } from 'zod';
import { DRIFT_TYPES } from './contract-drift-detector.schema';

export const triageCandidateSchema = z.object({
  file: z
    .string()
    .describe('Repo-relative path of the changed glomopay_service file.'),
  driftType: z
    .enum(DRIFT_TYPES)
    .describe(
      'The drift class this change takes on the response contract. Classify from the backend change alone — do NOT decide whether it breaks the frontend; that is the verifier stage.',
    ),
  wireField: z
    .string()
    .describe(
      'The camelCase key the frontend would see for the affected field (backend snake_case field converted to camelCase, e.g. settled_at -> settledAt). Use "" if the change is not tied to a single field (e.g. a whole-object reshape).',
    ),
  endpoint: z
    .string()
    .describe(
      'The static path SEGMENT of the affected endpoint to seed the verifier search — drop the /public or /api/int prefix and any interpolated id (e.g. "v1/payments", "v1/orders", "v1/checkout/preferences"). Use "" if you cannot pin it to one endpoint.',
    ),
  change: z
    .string()
    .describe(
      'The drift type + what changed (e.g. "field-renamed: settled_at -> finalized_at", "enum-value-changed: payin pending -> active").',
    ),
  backendEvidence: z
    .string()
    .describe(
      'The concrete glomopay_service artifact you FETCHED that establishes this change: the serializer / model / status-mapper / migration file:line you opened and what it shows. Reference a real path — never a deferral.',
    ),
});

export const triageResultSchema = z.object({
  candidates: z
    .array(triageCandidateSchema)
    .describe(
      'One entry per in-scope wire-contract change this PR makes. Enumerate broadly — the verifier stage decides which actually break the frontend. Do NOT pre-filter for "probably safe"; only exclude out-of-scope (external S2S / webhook builder) changes, record-set/row-filtering changes, and pure input-contract changes.',
    ),
  notes: z
    .string()
    .describe(
      '1-3 sentences: what you fetched in glomopay_service (name the PR files and any blast-radius files you followed), and what you looked at and excluded from candidates (out-of-scope, record-set, input-contract) and why.',
    ),
});

export type TriageCandidate = z.infer<typeof triageCandidateSchema>;
export type TriageResult = z.infer<typeof triageResultSchema>;
