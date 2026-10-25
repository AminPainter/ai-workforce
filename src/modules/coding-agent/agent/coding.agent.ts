import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import type { ToolSet } from 'ai';
import { codingAgentSettings } from './coding.settings.js';

export const CODING_AGENT = 'coding-agent';

export function createCodingAgent(
  configService: ConfigService,
  githubToken: string,
  tools: ToolSet = {},
) {
  return new HarnessAgent({
    ...codingAgentSettings(configService, githubToken),
    tools,
  });
}

export function createCodingAgentFactory(configService: ConfigService) {
  return (githubToken: string) => createCodingAgent(configService, githubToken);
}

export type CodingAgentFactory = ReturnType<typeof createCodingAgentFactory>;
