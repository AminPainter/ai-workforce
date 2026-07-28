import type { PullRequestMergedPayload } from '../../github/github.events';

export const CONTRACT_DRIFT_QUEUE = 'contract-drift';

export interface ContractDriftJob {
  payload: PullRequestMergedPayload;
}
