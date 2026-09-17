import { z } from 'zod';
import { FORM9_L1_VALUES } from '../mapping/form9-mapping';

// The agent classifies the taxonomy only. Form 9 is DERIVED from it by
// form9-mapping (a rule, not a judgement), so a regulator query is answered with
// the mapping row rather than the model's opinion.
export const form9TaxonomySchema = z.object({
  issueType1: z
    .enum(FORM9_L1_VALUES as [string, ...string[]])
    .describe('The L1 rail the ticket arose under. Pick from the taxonomy.'),
  issueType2: z
    .string()
    .describe(
      'The L2 category, copied EXACTLY from the taxonomy tree under the chosen L1. Empty string only if no L2 fits.',
    ),
  issueType3: z
    .string()
    .describe(
      'The L3 leaf, copied EXACTLY from the taxonomy tree under the chosen L2. Empty string if no specific L3 fits — the mapping will fall back to the L2 or L1 default. Choosing the L3 chooses the Form 9 treatment, so pick the closest genuine fit.',
    ),
  reasoning: z
    .string()
    .describe(
      'One short sentence for why this taxonomy node fits. Never include customer names, amounts, account numbers, PANs, emails, or phone numbers.',
    ),
});

export type Form9Taxonomy = z.infer<typeof form9TaxonomySchema>;
