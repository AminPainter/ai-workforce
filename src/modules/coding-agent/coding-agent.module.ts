import { Module } from '@nestjs/common';
import { CodingAgentService } from './services/coding-agent.service';
import { GitService } from './services/git.service';
import { GithubPrService } from './services/github-pr.service';

@Module({
  providers: [CodingAgentService, GitService, GithubPrService],
  exports: [CodingAgentService],
})
export class CodingAgentModule {}
