import type { EmitterWebhookEvent } from '@octokit/webhooks';

export const GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT =
  'github.pull_request.merged_to_main';

export type PullRequestMergedPayload =
  EmitterWebhookEvent<'pull_request.closed'>['payload'];

export interface GitHubPullRequestMergedToMainEvent {
  id: string;
  payload: PullRequestMergedPayload;
}
