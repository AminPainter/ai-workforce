import { tool } from 'ai';
import { z } from 'zod';
import { kongRouteSyncResultSchema } from '../agent/kong-route-sync.schema.js';

export const SUBMIT_ROUTE_SYNC_RESULT_TOOL = 'submitRouteSyncResult';

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
