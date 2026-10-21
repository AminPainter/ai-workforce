import type { KongRouteSyncResult } from '../agent/kong-route-sync.schema';

export const KONG_ROUTE_SYNC_QUEUE = 'kong-route-sync';
export const KONG_ROUTE_SYNC_CODING_QUEUE = 'kong-route-sync-coding';
export const KONG_ROUTE_SYNC_NOTIFICATION_QUEUE =
  'kong-route-sync-notifications';

export interface SourcePullRequest {
  repo: string;
  number: number;
  url: string;
  title: string;
  authorLogin: string;
  mergeSha: string | null;
}

export interface RoutesFileChange {
  filename: string;
  status: string;
  patch?: string;
}

export interface KongRouteSyncJob {
  pullRequestOnRailsApp: SourcePullRequest;
}

export interface KongRouteSyncCodingJob {
  pullRequestOnRailsApp: SourcePullRequest;
  authorEmail: string | null;
  targetRepo: string;
  routesFiles: RoutesFileChange[];
}

export interface KongRouteSyncNotificationJob {
  pullRequestOnRailsApp: SourcePullRequest;
  authorEmail: string | null;
  result: KongRouteSyncResult;
}
