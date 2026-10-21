import { tool } from 'ai';
import { z } from 'zod';
import { kongRouteSyncResultSchema } from '../agent/kong-route-sync.schema';

export const SUBMIT_ROUTE_SYNC_RESULT_TOOL = 'submitRouteSyncResult';

// The Pi harness rejects structured output (json responseFormat), so the
// result comes back as this tool's schema-validated input instead. Anthropic
// requires an object at the top level of a tool schema, hence the wrapper.
export const submitRouteSyncResultInputSchema = z.object({
  result: kongRouteSyncResultSchema,
});

export const submitRouteSyncResultTool = tool({
  description:
    'Report the outcome of the Kong route sync. Call this exactly once, as your final action, after the pull request is open or once you have determined there are no route changes.',
  inputSchema: submitRouteSyncResultInputSchema,
  execute: () =>
    'Result recorded. You are done; reply with a one-line summary.',
});
