import type { KongRouteSyncResult } from '../agent/kong-route-sync.schema.js';

export const KONG_ROUTE_SYNC_QUEUE = 'kong-route-sync';
export const KONG_ROUTE_SYNC_CODING_QUEUE = 'kong-route-sync-coding';
export const KONG_ROUTE_SYNC_NOTIFICATION_QUEUE =
  'kong-route-sync-notifications';

export interface RailsAppPullRequest {
  repo: string;
  number: number;
  url: string;
  title: string;
  authorUsername: string;
  mergeSha: string | null;
}

export interface RoutesFileChange {
  filename: string;
  status: string;
  patch?: string;
}

export interface KongRouteSyncJob {
  pullRequestOnRailsApp: RailsAppPullRequest;
}

export interface KongRouteSyncCodingJob {
  pullRequestOnRailsApp: RailsAppPullRequest;
  authorEmail: string;
  routesFiles: RoutesFileChange[];
}

export interface KongRouteSyncNotificationJob {
  pullRequestOnRailsApp: RailsAppPullRequest;
  authorEmail: string;
  result: KongRouteSyncResult;
}
