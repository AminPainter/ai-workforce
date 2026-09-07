import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { SlackBotService } from './services/slack-bot.service';
import { SlackWebhookController } from './controllers/slack-webhook.controller';

@Module({
  imports: [AgentsModule],
  providers: [SlackBotService],
  controllers: [SlackWebhookController],
  exports: [SlackBotService],
})
export class SlackModule {}
