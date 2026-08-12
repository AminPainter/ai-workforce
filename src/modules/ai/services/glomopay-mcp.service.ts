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

const ALLOWED_TOOLS = new Set<string>([]);

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
      this.tools = this.filterAllowedTools(await this.client!.tools());
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

  private filterAllowedTools(
    all: Awaited<ReturnType<MCPClient['tools']>>,
  ): ToolSet {
    if (ALLOWED_TOOLS.size === 0) {
      const discovered = Object.keys(all);
      this.logger.warn(
        `Glomopay MCP ALLOWED_TOOLS is empty; passing through all ${discovered.length} discovered tools until it is populated: ${discovered.join(', ')}`,
      );
      return all as ToolSet;
    }

    const allowed = Object.fromEntries(
      Object.entries(all).filter(([name]) => ALLOWED_TOOLS.has(name)),
    );

    const kept = Object.keys(allowed);
    const dropped = Object.keys(all).filter((name) => !ALLOWED_TOOLS.has(name));
    this.logger.log(
      `Glomopay MCP connected. Loaded ${kept.length} tools: ${kept.join(', ')}`,
    );
    this.logger.debug(`Glomopay MCP tools dropped: ${dropped.join(', ')}`);

    return allowed as ToolSet;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }
}
