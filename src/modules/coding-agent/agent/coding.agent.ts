import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import type { ToolSet } from 'ai';
import { codingAgentSettings } from './coding.settings';

export const CODING_AGENT = 'coding-agent';

export function createCodingAgent(
  configService: ConfigService,
  tools: ToolSet = {},
) {
  return new HarnessAgent({ ...codingAgentSettings(configService), tools });
}

export type CodingAgent = ReturnType<typeof createCodingAgent>;
