import { z } from 'zod';

export const KONG_ROUTE_SYNC_RESULT_PREFIX = 'ROUTE_SYNC_RESULT:';

export const kongRouteSyncResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('no-route-changes') }),
  z.object({
    status: z.literal('pr-opened'),
    routesAdded: z.array(z.string()),
    routesRemoved: z.array(z.string()),
    kongPrUrl: z.string().url(),
  }),
]);

export type KongRouteSyncResult = z.infer<typeof kongRouteSyncResultSchema>;

// The Pi harness rejects structured output, so the agent ends its reply with
// a single prefixed JSON line instead.
export function parseKongRouteSyncResult(text: string): KongRouteSyncResult {
  const line = text
    .split('\n')
    .map((candidate) => candidate.replace(/`/g, '').trim())
    .reverse()
    .find((candidate) => candidate.startsWith(KONG_ROUTE_SYNC_RESULT_PREFIX));
  if (!line)
    throw new Error(
      `agent reply has no ${KONG_ROUTE_SYNC_RESULT_PREFIX} line: ${text.slice(-500)}`,
    );

  return kongRouteSyncResultSchema.parse(
    JSON.parse(line.slice(KONG_ROUTE_SYNC_RESULT_PREFIX.length)),
  );
}
