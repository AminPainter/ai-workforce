import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SkillsModule } from '../skills/skills.module';
import { SnacksLedgerModule } from '../snack-tracker/snacks-ledger.module';
import { EmployeeAssistantAgentRegistrationService } from './services/employee-assistant-agent-registration.service';

@Module({
  imports: [AiModule, AgentsModule, SkillsModule, SnacksLedgerModule],
  providers: [EmployeeAssistantAgentRegistrationService],
})
export class EmployeeAssistantModule {}
