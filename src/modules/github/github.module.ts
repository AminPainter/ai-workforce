import { Module } from '@nestjs/common';
import { GitHubAppModule } from './github-app.module';
import { GitHubWebhookController } from './controllers/github-webhook.controller';
import { GitHubWebhookService } from './services/github-webhook.service';

@Module({
  imports: [GitHubAppModule],
  providers: [GitHubWebhookService],
  controllers: [GitHubWebhookController],
  exports: [GitHubAppModule],
})
export class GitHubModule {}
