import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentsModule } from '../agents/agents.module';
import { SlackModule } from '../slack/slack.module';
import { GitHubWebhookController } from './controllers/github-webhook.controller';
import { GitHubWebhookService } from './services/github-webhook.service';
import { ContractDriftProcessor } from './processors/contract-drift.processor';
import { CONTRACT_DRIFT_QUEUE } from './queues/contract-drift.queue';

@Module({
  imports: [
    AgentsModule,
    SlackModule,
    BullModule.registerQueue({ name: CONTRACT_DRIFT_QUEUE }),
  ],
  providers: [GitHubWebhookService, ContractDriftProcessor],
  controllers: [GitHubWebhookController],
})
export class GitHubModule {}
