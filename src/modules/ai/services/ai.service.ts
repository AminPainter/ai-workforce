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
import { WebTool } from '../constants/web-tools';

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

  webTools() {
    const searxngBaseUrl = this.config.getOrThrow<string>('SEARXNG_BASE_URL');
    return {
      [WebTool.WEB_SEARCH]: createWebSearchTool(searxngBaseUrl),
      [WebTool.WEB_FETCH]: createWebFetchTool(),
    };
  }
}
