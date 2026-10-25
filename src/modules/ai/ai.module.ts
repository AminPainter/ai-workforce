import { Module } from '@nestjs/common';
import { AiService } from './services/ai.service.js';
import { SentryMcpService } from './services/sentry-mcp.service.js';
import { GitHubMcpService } from './services/github-mcp.service.js';
import { AtlassianMcpService } from './services/atlassian-mcp.service.js';
import { AlloyDbMcpService } from './services/alloydb-mcp.service.js';
import { GitHubAppModule } from '../github/github-app.module.js';

@Module({
  imports: [GitHubAppModule],
  providers: [
    AiService,
    SentryMcpService,
    GitHubMcpService,
    AtlassianMcpService,
    AlloyDbMcpService,
  ],
  exports: [
    AiService,
    SentryMcpService,
    GitHubMcpService,
    AtlassianMcpService,
    AlloyDbMcpService,
  ],
})
export class AiModule {}
