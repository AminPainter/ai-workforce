import type { EmitterWebhookEvent } from '@octokit/webhooks';

export const CONTRACT_DRIFT_QUEUE = 'contract-drift';

export type PullRequestPayload = EmitterWebhookEvent<'pull_request'>['payload'];

export interface ContractDriftJob {
  payload: PullRequestPayload;
}
