import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { SlackBotService } from './services/slack-bot.service.js';
import { LeavesSlackBotService } from './services/leaves-slack-bot.service.js';
import { SlackWebhookController } from './controllers/slack-webhook.controller.js';

@Module({
  imports: [AgentsModule],
  providers: [SlackBotService, LeavesSlackBotService],
  controllers: [SlackWebhookController],
  exports: [SlackBotService, LeavesSlackBotService],
})
export class SlackModule {}
