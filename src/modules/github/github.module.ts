import { Module } from '@nestjs/common';
import { GitHubWebhookController } from './controllers/github-webhook.controller';
import { GitHubWebhookService } from './services/github-webhook.service';

@Module({
  providers: [GitHubWebhookService],
  controllers: [GitHubWebhookController],
})
export class GitHubModule {}
