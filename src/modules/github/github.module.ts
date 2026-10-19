import { Module } from '@nestjs/common';
import { GitHubWebhookController } from './controllers/github-webhook.controller';
import { GitHubWebhookService } from './services/github-webhook.service';
import { GitHubApiService } from './services/github-api.service';

@Module({
  providers: [GitHubWebhookService, GitHubApiService],
  controllers: [GitHubWebhookController],
  exports: [GitHubApiService],
})
export class GitHubModule {}
