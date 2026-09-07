import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SnackTrackerService } from './services/snack-tracker.service';
import { SnacksPledgeLedgerService } from './services/snacks-pledge-ledger.service';
import { SnackTrackerAgentRegistrationService } from './services/snack-tracker-agent-registration.service';
import { JiraClientService } from './jira/jira-client.service';

@Module({
  imports: [AiModule, AgentsModule],
  providers: [
    SnackTrackerService,
    SnacksPledgeLedgerService,
    SnackTrackerAgentRegistrationService,
    JiraClientService,
  ],
  exports: [SnackTrackerService],
})
export class SnackTrackerModule {}
