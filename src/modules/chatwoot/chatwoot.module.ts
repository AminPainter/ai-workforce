import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { ChatwootWebhookController } from './controllers/chatwoot-webhook.controller';
import { ChatwootWebhookService } from './services/chatwoot-webhook.service';
import { ChatwootApiClient } from './services/chatwoot-api.client';
import { ChatwootListener } from './chatwoot.listener';
import { ChatwootProcessor } from './processors/chatwoot.processor';
import { CustomerSupportAgentRegistrationService } from './services/customer-support-agent-registration.service';
import { CHATWOOT_QUEUE } from './queues/chatwoot.queue';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    BullModule.registerQueue({ name: CHATWOOT_QUEUE }),
  ],
  controllers: [ChatwootWebhookController],
  providers: [
    ChatwootWebhookService,
    ChatwootApiClient,
    ChatwootListener,
    ChatwootProcessor,
    CustomerSupportAgentRegistrationService,
  ],
})
export class ChatwootModule {}
