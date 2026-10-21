import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';
import { type LanguageModel } from 'ai';
import { createWebSearchTool } from '../tools/web-search.tool';
import { createWebFetchTool } from '../tools/web-fetch.tool';
import { AiModel } from '../constants/ai-models';

@Injectable()
export class AiService {
  private readonly provider: OpenAICompatibleProvider;

  constructor(private readonly config: ConfigService) {
    this.provider = createOpenAICompatible({
      name: 'ai-gateway',
      apiKey: this.config.getOrThrow<string>('AI_GATEWAY_API_KEY'),
      baseURL: this.config.getOrThrow<string>('AI_GATEWAY_BASE_URL'),
      supportsStructuredOutputs: true,
    });
  }

  model(aiModel: AiModel): LanguageModel {
    return this.provider(aiModel);
  }

  webTools() {
    const searxngBaseUrl = this.config.getOrThrow<string>('SEARXNG_BASE_URL');
    return {
      webSearch: createWebSearchTool(searxngBaseUrl),
      webFetch: createWebFetchTool(),
    };
  }
}
