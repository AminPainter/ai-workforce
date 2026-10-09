import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { SlackBotService } from './services/slack-bot.service';
import { LeavesSlackBotService } from './services/leaves-slack-bot.service';
import { SlackWebhookController } from './controllers/slack-webhook.controller';

@Module({
  imports: [AgentsModule],
  providers: [SlackBotService, LeavesSlackBotService],
  controllers: [SlackWebhookController],
  exports: [SlackBotService, LeavesSlackBotService],
})
export class SlackModule {}
