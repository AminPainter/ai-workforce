import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SlackModule } from '../slack/slack.module';
import { SnacksLedgerModule } from './snacks-ledger.module';
import { SnackTrackerAgentRegistrationService } from './services/snack-tracker-agent-registration.service';
import { SnackTrackerListener } from './snack-tracker.listener';
import { SnackTrackerProcessor } from './processors/snack-tracker.processor';
import { SNACK_TRACKER_QUEUE } from './queues/snack-tracker.queue';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    SlackModule,
    SnacksLedgerModule,
    BullModule.registerQueue({ name: SNACK_TRACKER_QUEUE }),
  ],
  providers: [
    SnackTrackerAgentRegistrationService,
    SnackTrackerListener,
    SnackTrackerProcessor,
  ],
})
export class SnackTrackerModule {}
