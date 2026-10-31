import { z } from 'zod';
import { FORM9_L1_VALUES } from '../mapping/form9-mapping.js';

// The agent classifies the taxonomy only. Form 9 is DERIVED from it by
// form9-mapping (a rule, not a judgement), so a regulator query is answered with
// the mapping row rather than the model's opinion.
export const form9TaxonomySchema = z.object({
  issueType1: z
    .enum(FORM9_L1_VALUES as [string, ...string[]])
    .describe('Issue Type 1: the product. Pick from the taxonomy.'),
  issueType2: z
    .string()
    .describe(
      'Issue Type 2, copied EXACTLY from the taxonomy tree under the chosen Issue Type 1.',
    ),
  issueType3: z
    .string()
    .describe(
      'Issue Type 3, copied EXACTLY from the taxonomy tree under the chosen Issue Type 2. Every ticket needs one; pick the closest genuine fit for the latest state of the ticket.',
    ),
  escalated: z
    .boolean()
    .describe(
      'True when the customer has expressed dissatisfaction (still waiting, repeated reminders, asks to escalate) or more than 48 business hours have passed since the debit or request with the matter still unresolved. False otherwise.',
    ),
  escalatedAt: z
    .string()
    .describe(
      'When escalated is true: the timestamp of the message that triggered it, copied from the conversation. Empty string otherwise or when unknown.',
    ),
  reasoning: z
    .string()
    .describe(
      'One short sentence for why this taxonomy node fits. Never include customer names, amounts, account numbers, PANs, emails, or phone numbers.',
    ),
});

export type Form9Taxonomy = z.infer<typeof form9TaxonomySchema>;
