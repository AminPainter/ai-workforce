import { z } from 'zod';

export const snacksPledgeClassificationSchema = z.object({
  isSnacksPledge: z
    .boolean()
    .describe(
      'true only if the author is promising to bring, buy, or treat the group to snacks/food/drinks LATER and has not done it yet. false for anything else, including snacks already ordered/bought/on the way ("I have ordered samosas, arriving shortly"), talking ABOUT snacks, past-tense ("the snacks were great"), questions, or negations ("no snacks today").',
    ),
  reason: z.string().describe('One short sentence explaining the decision.'),
});

export type SnacksPledgeClassification = z.infer<
  typeof snacksPledgeClassificationSchema
>;
