import { ConfigService } from '@nestjs/config';
import { createCodingAgent } from '../../coding-agent/agent/coding.agent.js';
import {
  SUBMIT_ROUTE_SYNC_RESULT_TOOL,
  submitRouteSyncResultTool,
} from '../tools/submit-route-sync-result.tool.js';

export const KONG_ROUTE_SYNC_CODING_AGENT = 'kong-route-sync-coding-agent';

export function createKongRouteSyncCodingAgentFactory(
  configService: ConfigService,
) {
  return (githubToken: string) =>
    createCodingAgent(configService, githubToken, {
      [SUBMIT_ROUTE_SYNC_RESULT_TOOL]: submitRouteSyncResultTool,
    });
}

export type KongRouteSyncCodingAgentFactory = ReturnType<
  typeof createKongRouteSyncCodingAgentFactory
>;
