import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { type ToolSet } from 'ai';

const DEFAULT_GLOMOPAY_MCP_URL = 'https://glomopay-mcp.onrender.com/mcp';

@Injectable()
export class GlomopayMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GlomopayMcpService.name);
  private readonly glomopayMcpUrl: string;
  private readonly glomopayToken: string;
  private client?: MCPClient;
  private tools: ToolSet = {};

  constructor(private readonly config: ConfigService) {
    this.glomopayMcpUrl =
      this.config.get<string>('GLOMOPAY_MCP_URL') ?? DEFAULT_GLOMOPAY_MCP_URL;
    this.glomopayToken = this.config.getOrThrow<string>('GLOMOPAY_MCP_TOKEN');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.tools = (await this.client!.tools()) as ToolSet;
      this.logger.log(
        `Glomopay MCP connected. Loaded ${Object.keys(this.tools).length} tools: ${Object.keys(this.tools).join(', ')}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Glomopay MCP unavailable, continuing without Glomopay tools: ${reason}`,
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
        url: this.glomopayMcpUrl,
        headers: { Authorization: `Bearer ${this.glomopayToken}` },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }
}
