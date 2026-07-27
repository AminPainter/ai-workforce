import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { SlackBotService } from './services/slack-bot.service';
import { SlackNotifierService } from './services/slack-notifier.service';
import { SlackWebhookController } from './controllers/slack-webhook.controller';

@Module({
  imports: [AgentsModule],
  providers: [SlackBotService, SlackNotifierService],
  controllers: [SlackWebhookController],
  exports: [SlackNotifierService],
})
export class SlackModule {}
