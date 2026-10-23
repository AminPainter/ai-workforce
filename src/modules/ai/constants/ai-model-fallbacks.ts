import { AiModel } from './ai-models';

// Same-tier models, tried in order. All Cloudflare models share one Workers AI
// quota, so Cloudflare primaries fall back to Bedrock models first.
export const AI_MODEL_FALLBACKS: Record<AiModel, AiModel[]> = {
  [AiModel.GROK_4_6]: [
    AiModel.GPT_5_6_SOL,
    AiModel.CLAUDE_OPUS_5_5,
    AiModel.KIMI_K3,
  ],
  [AiModel.CLAUDE_OPUS_5_5]: [
    AiModel.GPT_5_6_SOL,
    AiModel.KIMI_K3,
    AiModel.GROK_4_6,
  ],
  [AiModel.GPT_5_6_SOL]: [
    AiModel.CLAUDE_OPUS_5_5,
    AiModel.KIMI_K3,
    AiModel.GROK_4_6,
  ],
  [AiModel.KIMI_K3]: [
    AiModel.GPT_5_6_SOL,
    AiModel.CLAUDE_OPUS_5_5,
    AiModel.GROK_4_6,
  ],
  [AiModel.GLM_5_2]: [AiModel.GLM_5, AiModel.QWEN3_235B],
  [AiModel.GLM_5]: [AiModel.QWEN3_235B, AiModel.GLM_5_2],
  [AiModel.QWEN3_235B]: [AiModel.GLM_5, AiModel.GLM_5_2],
  [AiModel.CLAUDE_HAIKU_4_5]: [AiModel.GLM_5, AiModel.QWEN3_235B],
};
