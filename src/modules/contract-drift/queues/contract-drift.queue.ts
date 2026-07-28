import type { PullRequestPayload } from '../../github/github.events';

export const CONTRACT_DRIFT_QUEUE = 'contract-drift';

export interface ContractDriftJob {
  payload: PullRequestPayload;
}
