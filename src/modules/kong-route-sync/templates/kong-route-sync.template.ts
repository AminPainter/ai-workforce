import type { RailsAppPullRequest } from '../queues/kong-route-sync.queue';

const OPT_OUT_SLACK_USER_ID = 'U0857R1RB9Q';

export interface KongRouteSyncSummary {
  pullRequestOnRailsApp: RailsAppPullRequest;
  kongPrUrl: string;
}

export function buildKongRouteSyncDirectMessage({
  pullRequestOnRailsApp,
  kongPrUrl,
}: KongRouteSyncSummary): string {
  return `Amin Ka Bot is here to make your life easy!
I saw you did some route changes on glomopay_service: ${pullRequestOnRailsApp.url}
Here's the kong PR required for your changes: ${kongPrUrl}

If you'd like to opt out of this feature, please DM <@${OPT_OUT_SLACK_USER_ID}>.`;
}
