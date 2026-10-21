import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { GitHubWebhookController } from './controllers/github-webhook.controller';
import { GitHubWebhookService } from './services/github-webhook.service';

@Module({
  providers: [
    GitHubWebhookService,
    {
      provide: Octokit,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Octokit({ auth: configService.getOrThrow<string>('GITHUB_PAT') }),
    },
  ],
  controllers: [GitHubWebhookController],
  exports: [Octokit],
})
export class GitHubModule {}
