import { z } from 'zod';

export const snackCommandSchema = z.object({
  intent: z
    .enum(['list', 'settle', 'unknown'])
    .describe(
      '"list" = the author wants to see who currently owes snacks. "settle" = someone has paid up / brought the snacks and their pending tab should be cleared. "unknown" = anything else.',
    ),
  settleSelf: z
    .boolean()
    .describe(
      'For a settle intent with no other person mentioned: true if the author is settling THEIR OWN tab (e.g. "I brought them", "clear my tab", "paid"). false otherwise.',
    ),
});

export type SnackCommand = z.infer<typeof snackCommandSchema>;
