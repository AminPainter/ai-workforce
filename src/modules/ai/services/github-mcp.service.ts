import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { type ToolSet } from 'ai';

const DEFAULT_GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/readonly';

const READ_ONLY_TOOLS = new Set([
  'get_me',
  'get_file_contents',
  'search_code',
  'search_commits',
  'search_repositories',
  'search_users',
  'list_commits',
  'get_commit',
  'list_pull_requests',
  'get_pull_request',
  'get_pull_request_files',
  'get_pull_request_diff',
  'pull_request_read',
  'list_issues',
  'get_issue',
  'get_issue_comments',
  'issue_read',
  'list_issue_types',
  'list_issue_fields',
  'search_issues',
  'search_pull_requests',
  'list_branches',
  'list_tags',
  'get_tag',
  'list_releases',
  'get_latest_release',
  'get_release_by_tag',
]);

@Injectable()
export class GitHubMcpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GitHubMcpService.name);
  private readonly githubMcpUrl: string;
  private readonly githubToken: string;
  private client?: MCPClient;
  private tools: ToolSet = {};

  constructor(private readonly config: ConfigService) {
    this.githubMcpUrl =
      this.config.get<string>('GITHUB_MCP_URL') ?? DEFAULT_GITHUB_MCP_URL;
    this.githubToken = this.config.getOrThrow<string>('GITHUB_PAT');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.tools = this.filterReadOnlyTools(await this.client!.tools());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `GitHub MCP unavailable, continuing without GitHub tools: ${reason}`,
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
        url: this.githubMcpUrl,
        headers: { Authorization: `Bearer ${this.githubToken}` },
      },
    });
  }

  private filterReadOnlyTools(
    all: Awaited<ReturnType<MCPClient['tools']>>,
  ): ToolSet {
    const readOnly = Object.fromEntries(
      Object.entries(all).filter(([name]) => READ_ONLY_TOOLS.has(name)),
    );

    const kept = Object.keys(readOnly);
    const dropped = Object.keys(all).filter(
      (name) => !READ_ONLY_TOOLS.has(name),
    );
    this.logger.log(
      `GitHub MCP connected. Loaded ${kept.length} tools: ${kept.join(', ')}`,
    );
    this.logger.debug(`GitHub MCP tools dropped: ${dropped.join(', ')}`);

    return readOnly;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }
}
