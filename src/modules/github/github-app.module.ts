import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { gitHubAppAuthOptions } from './github-app-auth.options';
import { GitHubAppAuthService } from './services/github-app-auth.service';

@Module({
  providers: [
    GitHubAppAuthService,
    {
      provide: Octokit,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Octokit({
          authStrategy: createAppAuth,
          auth: gitHubAppAuthOptions(configService),
        }),
    },
  ],
  exports: [GitHubAppAuthService, Octokit],
})
export class GitHubAppModule {}
