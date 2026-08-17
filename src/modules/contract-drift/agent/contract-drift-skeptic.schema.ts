import { z } from 'zod';

export const skepticVerdictSchema = z.object({
  refuted: z
    .boolean()
    .describe(
      'true if you could NOT independently reproduce the claimed break — you failed to open the exact zod field that throws or the read site that mis-behaves, or the break only "might" happen. Default to true unless you personally confirmed the break against glomopay-checkout main. false only when you re-verified the exact breaking artifact yourself.',
    ),
  reason: z
    .string()
    .describe(
      'One short sentence: what you opened in glomopay-checkout and why the claim survives (refuted=false) or fails (refuted=true) — name the file:line you checked.',
    ),
});

export type SkepticVerdict = z.infer<typeof skepticVerdictSchema>;
