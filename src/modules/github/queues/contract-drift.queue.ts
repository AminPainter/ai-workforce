import type { EmitterWebhookEvent } from '@octokit/webhooks';

export const CONTRACT_DRIFT_QUEUE = 'contract-drift';

export type PushPayload = EmitterWebhookEvent<'push'>['payload'];

export interface ContractDriftJob {
  payload: PushPayload;
}
