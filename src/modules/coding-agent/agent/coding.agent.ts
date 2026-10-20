import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createPi } from '@ai-sdk/harness-pi';
import { CODING_AGENT_SYSTEM_PROMPT } from './coding.prompt';

export const CODING_AGENT = 'coding-agent';
export const REPO_DIR = 'repo';

const PROVIDER_ID = 'glomo';
const MODEL_ID = 'claude-opus-5-5';
const MODEL_CONTEXT_WINDOW = 1000000;
const MODEL_MAX_TOKENS = 128000;
const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';

export function createCodingAgent(configService: ConfigService) {
  return new HarnessAgent({
    harness: createPi({
      providers: {
        [PROVIDER_ID]: {
          baseUrl: configService.getOrThrow<string>('AI_GATEWAY_BASE_URL'),
          apiKey: configService.getOrThrow<string>('AI_GATEWAY_API_KEY'),
          api: 'openai-completions',
          models: [
            {
              id: MODEL_ID,
              name: MODEL_ID,
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: MODEL_CONTEXT_WINDOW,
              maxTokens: MODEL_MAX_TOKENS,
            },
          ],
        },
      },
      mcpServers: {
        github: {
          type: 'http',
          url: GITHUB_MCP_URL,
          headers: {
            Authorization: `Bearer ${configService.getOrThrow<string>('GITHUB_PAT')}`,
          },
          exposure: 'hidden',
          toolExposure: {
            create_pull_request: 'direct',
            list_pull_requests: 'direct',
            pull_request_read: 'direct',
          },
        },
      },
    }),
    model: `${PROVIDER_ID}/${MODEL_ID}`,
    instructions: CODING_AGENT_SYSTEM_PROMPT,
    sandboxConfig: { workDir: REPO_DIR },
  });
}

export type CodingAgent = ReturnType<typeof createCodingAgent>;
