import { z } from 'zod';

export const kongRouteSyncResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('no-route-changes') }),
  z.object({
    status: z.literal('pr-opened'),
    routesAdded: z
      .array(z.string())
      .describe(
        'Added routes as HTTP method + path, e.g. "GET /api/v1/payouts".',
      ),
    routesRemoved: z
      .array(z.string())
      .describe('Removed routes as HTTP method + path.'),
    kongPrUrl: z.string().url().describe('URL of the draft pull request.'),
  }),
]);

export type KongRouteSyncResult = z.infer<typeof kongRouteSyncResultSchema>;
