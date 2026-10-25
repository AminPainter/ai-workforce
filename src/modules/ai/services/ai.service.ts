import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';
import { type LanguageModel } from 'ai';
import { AiModel } from '../constants/ai-models.js';

@Injectable()
export class AiService {
  private readonly provider: OpenAICompatibleProvider;

  constructor(private readonly config: ConfigService) {
    this.provider = createOpenAICompatible({
      name: 'ai-gateway',
      apiKey: this.config.getOrThrow<string>('AI_GATEWAY_API_KEY'),
      baseURL: `${this.config.getOrThrow<string>('AI_GATEWAY_BASE_URL')}/v1`,
      supportsStructuredOutputs: true,
    });
  }

  model(aiModel: AiModel): LanguageModel {
    return this.provider(aiModel);
  }
}
