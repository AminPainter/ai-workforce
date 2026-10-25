import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { SlackModule } from '../slack/slack.module.js';
import { SnacksLedgerModule } from './snacks-ledger.module.js';
import { SnackTrackerAgentRegistrationService } from './services/snack-tracker-agent-registration.service.js';
import { SnackTrackerListener } from './snack-tracker.listener.js';
import { SnackTrackerProcessor } from './processors/snack-tracker.processor.js';
import { SNACK_TRACKER_QUEUE } from './queues/snack-tracker.queue.js';

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
