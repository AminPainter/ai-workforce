import type { SourcePullRequest } from '../queues/kong-route-sync.queue';

export interface KongRouteSyncSummary {
  pullRequestOnRailsApp: SourcePullRequest;
  routesAdded: string[];
  routesRemoved: string[];
  kongPrUrl: string;
}

export function buildKongRouteSyncDirectMessage({
  pullRequestOnRailsApp,
  routesAdded,
  routesRemoved,
  kongPrUrl,
}: KongRouteSyncSummary): string {
  return `Hey! Your glomopay_service PR #${pullRequestOnRailsApp.number} changed routes, so I've opened a kong PR to mirror them.

Routes added: ${formatRoutes(routesAdded)}
Routes removed: ${formatRoutes(routesRemoved)}

Kong PR: ${kongPrUrl}
Source PR: ${pullRequestOnRailsApp.url}

It's a draft — please give it a look and get it reviewed and merged.`;
}

function formatRoutes(routes: string[]): string {
  return routes.length > 0 ? routes.join(', ') : 'none';
}
