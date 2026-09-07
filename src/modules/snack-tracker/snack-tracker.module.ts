import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SnackTrackerService } from './services/snack-tracker.service';
import { SnacksPledgeLedgerService } from './services/snacks-pledge-ledger.service';
import { SnackTrackerAgentRegistrationService } from './services/snack-tracker-agent-registration.service';
import { SnackTrackerListener } from './snack-tracker.listener';
import { JiraModule } from '../jira/jira.module';

@Module({
  imports: [AiModule, AgentsModule, JiraModule],
  providers: [
    SnackTrackerService,
    SnacksPledgeLedgerService,
    SnackTrackerAgentRegistrationService,
    SnackTrackerListener,
  ],
})
export class SnackTrackerModule {}
