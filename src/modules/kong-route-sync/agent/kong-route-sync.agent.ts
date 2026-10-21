import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { codingAgentSettings } from '../../coding-agent/agent/coding.agent';
import {
  SUBMIT_ROUTE_SYNC_RESULT_TOOL,
  submitRouteSyncResultTool,
} from '../tools/submit-route-sync-result.tool';

export const KONG_ROUTE_SYNC_AGENT = 'kong-route-sync-agent';

export function createKongRouteSyncAgent(configService: ConfigService) {
  return new HarnessAgent({
    ...codingAgentSettings(configService),
    tools: { [SUBMIT_ROUTE_SYNC_RESULT_TOOL]: submitRouteSyncResultTool },
  });
}

export type KongRouteSyncAgent = ReturnType<typeof createKongRouteSyncAgent>;
