import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { type ToolSet } from 'ai';

const DEFAULT_ATLASSIAN_MCP_URL = 'https://mcp.atlassian.com/v1/mcp';

export const ATLASSIAN_TOOL_NAMES = new Set([
  'createJiraIssue',
  'getVisibleJiraProjects',
  'getJiraProjectIssueTypesMetadata',
  'getJiraIssueTypeMetaWithFields',
  'searchJiraIssuesUsingJql',
  'getJiraIssue',
  'lookupJiraAccountId',
  'getAccessibleAtlassianResources',
  'atlassianUserInfo',
]);

@Injectable()
export class AtlassianMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AtlassianMcpService.name);
  private readonly atlassianMcpUrl: string;
  private readonly atlassianEmail: string;
  private readonly atlassianApiToken: string;
  private client?: MCPClient;
  private tools: ToolSet = {};

  constructor(private readonly config: ConfigService) {
    this.atlassianMcpUrl =
      this.config.get<string>('ATLASSIAN_MCP_URL') ?? DEFAULT_ATLASSIAN_MCP_URL;
    this.atlassianEmail = this.config.getOrThrow<string>('ATLASSIAN_EMAIL');
    this.atlassianApiToken = this.config.getOrThrow<string>(
      'ATLASSIAN_API_TOKEN',
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.tools = this.filterAllowedTools(await this.client!.tools());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Atlassian MCP unavailable, continuing without Atlassian tools: ${reason}`,
      );
    }
  }

  getTools(): ToolSet {
    return this.tools;
  }

  private async connect(): Promise<void> {
    // Personal API token → Basic auth. For an admin-managed service account key,
    // swap this for `Bearer ${apiKey}`.
    const credentials = Buffer.from(
      `${this.atlassianEmail}:${this.atlassianApiToken}`,
    ).toString('base64');

    this.client = await createMCPClient({
      transport: {
        type: 'http',
        url: this.atlassianMcpUrl,
        headers: { Authorization: `Basic ${credentials}` },
      },
    });
  }

  private filterAllowedTools(
    all: Awaited<ReturnType<MCPClient['tools']>>,
  ): ToolSet {
    const allowed = Object.fromEntries(
      Object.entries(all).filter(([name]) => ATLASSIAN_TOOL_NAMES.has(name)),
    );

    const kept = Object.keys(allowed);
    const dropped = Object.keys(all).filter(
      (name) => !ATLASSIAN_TOOL_NAMES.has(name),
    );
    this.logger.log(
      `Atlassian MCP connected. Loaded ${kept.length} tools: ${kept.join(', ')}`,
    );
    this.logger.debug(`Atlassian MCP tools dropped: ${dropped.join(', ')}`);

    return allowed;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }
}
