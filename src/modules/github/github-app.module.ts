import { Module } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { GitHubAppAuthService } from './services/github-app-auth.service.js';

@Module({
  providers: [
    GitHubAppAuthService,
    {
      provide: Octokit,
      inject: [GitHubAppAuthService],
      // Reuse the service's auth so Octokit and raw token callers share one token cache.
      useFactory: (gitHubAppAuthService: GitHubAppAuthService) =>
        new Octokit({ authStrategy: () => gitHubAppAuthService.auth }),
    },
  ],
  exports: [GitHubAppAuthService, Octokit],
})
export class GitHubAppModule {}
