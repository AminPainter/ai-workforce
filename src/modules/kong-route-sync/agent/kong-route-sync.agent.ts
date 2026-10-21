import { ConfigService } from '@nestjs/config';
import { createCodingAgent } from '../../coding-agent/agent/coding.agent';
import {
  SUBMIT_ROUTE_SYNC_RESULT_TOOL,
  submitRouteSyncResultTool,
} from '../tools/submit-route-sync-result.tool';

export const KONG_ROUTE_SYNC_AGENT = 'kong-route-sync-agent';

export function createKongRouteSyncAgent(configService: ConfigService) {
  return createCodingAgent(configService, {
    [SUBMIT_ROUTE_SYNC_RESULT_TOOL]: submitRouteSyncResultTool,
  });
}

export type KongRouteSyncAgent = ReturnType<typeof createKongRouteSyncAgent>;
