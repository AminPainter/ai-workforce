import { ConfigService } from '@nestjs/config';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createPi } from '@ai-sdk/harness-pi';
import { PI_CODING_AGENT_SYSTEM_PROMPT } from './pi-coding.prompt';

export const PI_CODING_AGENT = 'pi-coding-agent';
export const REPO_DIR = 'repo';

const PROVIDER_ID = 'glomo';
const MODEL_CONTEXT_WINDOW = 128000;
const MODEL_MAX_TOKENS = 16384;

export function createPiCodingAgent(configService: ConfigService) {
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
    }),
    model: `${PROVIDER_ID}/${modelId}`,
    instructions: PI_CODING_AGENT_SYSTEM_PROMPT,
    sandboxConfig: { workDir: REPO_DIR },
  });
}

export type PiCodingAgent = ReturnType<typeof createPiCodingAgent>;
