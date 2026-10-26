import { ConfigService } from '@nestjs/config';
import { createPi, type PiHarnessSettings } from '@ai-sdk/harness-pi';
import { AiModel } from '../../ai/constants/ai-models.js';
import { CODING_AGENT_SYSTEM_PROMPT } from './coding.prompt.js';

export const REPO_DIR = 'repo';

const PROVIDER_ID = 'glomo';
const MODEL_CONTEXT_WINDOW = 1000000;
const MODEL_MAX_TOKENS = 128000;
const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';

export const PI_MODEL = `${PROVIDER_ID}/${AiModel.CLAUDE_OPUS_5_5}`;

export function glomoPiProviders(
  configService: ConfigService,
): PiHarnessSettings['providers'] {
  return {
    [PROVIDER_ID]: {
      baseUrl: configService.getOrThrow<string>('AI_GATEWAY_BASE_URL'),
      apiKey: configService.getOrThrow<string>('AI_GATEWAY_API_KEY'),
      api: 'anthropic-messages',
      models: [
        {
          id: AiModel.CLAUDE_OPUS_5_5,
          name: AiModel.CLAUDE_OPUS_5_5,
          reasoning: true,
          compat: { forceAdaptiveThinking: true },
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: MODEL_CONTEXT_WINDOW,
          maxTokens: MODEL_MAX_TOKENS,
        },
      ],
    },
  };
}

export function codingAgentSettings(
  configService: ConfigService,
  githubToken: string,
) {
  return {
    harness: createPi({
      providers: glomoPiProviders(configService),
      thinkingLevel: 'high',
      cacheRetention: 'long',
      mcpServers: {
        github: {
          type: 'http',
          url: GITHUB_MCP_URL,
          headers: { Authorization: `Bearer ${githubToken}` },
          exposure: 'hidden',
          toolExposure: {
            create_pull_request: 'direct',
            list_pull_requests: 'direct',
            pull_request_read: 'direct',
          },
        },
      },
    }),
    model: PI_MODEL,
    instructions: CODING_AGENT_SYSTEM_PROMPT,
    sandboxConfig: { workDir: REPO_DIR },
  };
}
