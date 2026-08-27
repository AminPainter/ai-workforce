import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PI_PROVIDER_ID = 'ai-gateway';

export interface WritePiConfigInput {
  configDir: string;
  gatewayBaseUrl: string;
  modelSlug: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
}

export interface PiConfigPaths {
  agentDir: string;
  modelsPath: string;
  authPath: string;
  modelsStorePath: string;
  providerId: string;
  modelId: string;
}

export async function writePiConfig(
  input: WritePiConfigInput,
): Promise<PiConfigPaths> {
  await mkdir(input.configDir, { recursive: true });

  const modelsPath = join(input.configDir, 'models.json');
  const authPath = join(input.configDir, 'auth.json');
  const modelsStorePath = join(input.configDir, 'models-store.json');

  const models = {
    providers: {
      [PI_PROVIDER_ID]: {
        baseUrl: input.gatewayBaseUrl,
        api: 'openai-completions',
        apiKey: '$AI_GATEWAY_API_KEY',
        models: [
          {
            id: input.modelSlug,
            name: 'coding-agent',
            reasoning: input.reasoning ?? false,
            input: ['text'],
            contextWindow: input.contextWindow ?? 200000,
            maxTokens: input.maxTokens ?? 16000,
          },
        ],
      },
    },
  };

  await writeFile(modelsPath, JSON.stringify(models, null, 2), 'utf8');

  return {
    agentDir: input.configDir,
    modelsPath,
    authPath,
    modelsStorePath,
    providerId: PI_PROVIDER_ID,
    modelId: input.modelSlug,
  };
}
