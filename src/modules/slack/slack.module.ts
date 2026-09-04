import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { SnackTrackerModule } from '../snack-tracker/snack-tracker.module';
import { SlackBotService } from './services/slack-bot.service';
import { SlackWebhookController } from './controllers/slack-webhook.controller';

@Module({
  imports: [AgentsModule, SnackTrackerModule],
  providers: [SlackBotService],
  controllers: [SlackWebhookController],
  exports: [SlackBotService],
})
export class SlackModule {}
