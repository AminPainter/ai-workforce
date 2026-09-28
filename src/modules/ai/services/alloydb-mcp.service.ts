import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { type ToolSet } from 'ai';

@Injectable()
export class AlloyDbMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlloyDbMcpService.name);
  private readonly alloyDbMcpUrl: string;
  private readonly apiKey: string;
  private client?: MCPClient;
  private tools: ToolSet = {};

  constructor(private readonly config: ConfigService) {
    this.alloyDbMcpUrl = this.config.getOrThrow<string>('ALLOYDB_MCP_URL');
    this.apiKey = this.config.getOrThrow<string>('ALLOYDB_MCP_API_KEY');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.tools = (await this.client!.tools()) as ToolSet;
      this.logger.log(
        `AlloyDB MCP connected. Loaded ${Object.keys(this.tools).length} tools: ${Object.keys(this.tools).join(', ')}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `AlloyDB MCP unavailable, continuing without AlloyDB tools: ${reason}`,
      );
    }
  }

  getTools(): ToolSet {
    return this.tools;
  }

  private async connect(): Promise<void> {
    this.client = await createMCPClient({
      transport: {
        type: 'http',
        url: this.alloyDbMcpUrl,
        headers: { 'X-API-Key': this.apiKey },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }
}
