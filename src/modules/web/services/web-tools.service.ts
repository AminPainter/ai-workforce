import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ToolSet } from 'ai';
import { createWebSearchTool } from '../tools/web-search.tool.js';
import { createWebFetchTool } from '../tools/web-fetch.tool.js';
import { WebTool } from '../constants/web-tools.js';

@Injectable()
export class WebToolsService {
  constructor(private readonly configService: ConfigService) {}

  getTools(): ToolSet {
    const searxngBaseUrl =
      this.configService.getOrThrow<string>('SEARXNG_BASE_URL');
    return {
      [WebTool.WEB_SEARCH]: createWebSearchTool(searxngBaseUrl),
      [WebTool.WEB_FETCH]: createWebFetchTool(),
    };
  }
}
