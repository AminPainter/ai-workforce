import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { type ToolSet } from 'ai';

const DEFAULT_SENTRY_MCP_URL = 'https://mcp.sentry.dev/mcp';

export const SENTRY_TOOL_NAMES = new Set([
  'find_organizations',
  'find_projects',
  'search_issues',
  'search_events',
  'get_sentry_resource',
]);

@Injectable()
export class SentryMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SentryMcpService.name);
  private readonly sentryMcpUrl: string;
  private readonly sentryAuthToken: string;
  private client?: MCPClient;
  private tools: ToolSet = {};

  constructor(private readonly config: ConfigService) {
    this.sentryMcpUrl =
      this.config.get<string>('SENTRY_MCP_URL') ?? DEFAULT_SENTRY_MCP_URL;
    this.sentryAuthToken = this.config.getOrThrow<string>('SENTRY_AUTH_TOKEN');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.tools = this.filterReadOnlyTools(await this.client!.tools());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Sentry MCP unavailable, continuing without Sentry tools: ${reason}`,
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
        url: this.sentryMcpUrl,
        headers: { Authorization: `Sentry-Bearer ${this.sentryAuthToken}` },
      },
    });
  }

  private filterReadOnlyTools(
    all: Awaited<ReturnType<MCPClient['tools']>>,
  ): ToolSet {
    const readOnly = Object.fromEntries(
      Object.entries(all).filter(([name]) => SENTRY_TOOL_NAMES.has(name)),
    );

    const kept = Object.keys(readOnly);
    const dropped = Object.keys(all).filter(
      (name) => !SENTRY_TOOL_NAMES.has(name),
    );
    this.logger.log(
      `Sentry MCP connected. Loaded ${kept.length} tools: ${kept.join(', ')}`,
    );
    this.logger.debug(`Sentry MCP tools dropped: ${dropped.join(', ')}`);

    return readOnly;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }
}
