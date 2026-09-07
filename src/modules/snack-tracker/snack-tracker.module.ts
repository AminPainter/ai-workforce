import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SnackTrackerService } from './services/snack-tracker.service';
import { SnacksLedgerService } from './services/snacks-ledger.service';
import { SnackTrackerAgentRegistrationService } from './services/snack-tracker-agent-registration.service';
import { SnackTrackerListener } from './snack-tracker.listener';
import { JiraModule } from '../jira/jira.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [AiModule, AgentsModule, JiraModule, RedisModule],
  providers: [
    SnackTrackerService,
    SnacksLedgerService,
    SnackTrackerAgentRegistrationService,
    SnackTrackerListener,
  ],
})
export class SnackTrackerModule {}
