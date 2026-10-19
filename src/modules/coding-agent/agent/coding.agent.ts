import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createPi } from '@ai-sdk/harness-pi';
import { CODING_AGENT_SYSTEM_PROMPT } from './coding.prompt';

export const CODING_AGENT = 'coding-agent';
export const REPO_DIR = 'repo';

const PROVIDER_ID = 'glomo';
const MODEL_CONTEXT_WINDOW = 128000;
const MODEL_MAX_TOKENS = 16384;
const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';

export function createCodingAgent(configService: ConfigService) {
  const modelId = configService.getOrThrow<string>('AI_GATEWAY_MODEL');

  return new HarnessAgent({
    harness: createPi({
      providers: {
        [PROVIDER_ID]: {
          baseUrl: configService.getOrThrow<string>('AI_GATEWAY_BASE_URL'),
          apiKey: configService.getOrThrow<string>('AI_GATEWAY_API_KEY'),
          api: 'openai-completions',
          models: [
            {
              id: modelId,
              name: modelId,
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
    model: `${PROVIDER_ID}/${modelId}`,
    instructions: CODING_AGENT_SYSTEM_PROMPT,
    sandboxConfig: { workDir: REPO_DIR },
  });
}

export type CodingAgent = ReturnType<typeof createCodingAgent>;
