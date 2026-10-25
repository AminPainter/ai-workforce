import { Module } from '@nestjs/common';
import { GitHubAppModule } from './github-app.module.js';
import { GitHubWebhookController } from './controllers/github-webhook.controller.js';
import { GitHubWebhookService } from './services/github-webhook.service.js';

@Module({
  imports: [GitHubAppModule],
  providers: [GitHubWebhookService],
  controllers: [GitHubWebhookController],
  exports: [GitHubAppModule],
})
export class GitHubModule {}
