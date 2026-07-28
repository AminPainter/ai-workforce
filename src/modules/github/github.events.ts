import type { EmitterWebhookEvent } from '@octokit/webhooks';

export const GITHUB_PULL_REQUEST_EVENT = 'github.pull_request';

export type PullRequestPayload = EmitterWebhookEvent<'pull_request'>['payload'];

export interface GitHubPullRequestEvent {
  id: string;
  payload: PullRequestPayload;
}
