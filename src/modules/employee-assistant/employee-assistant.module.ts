import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SkillsModule } from '../skills/skills.module';
import { SnacksLedgerModule } from '../snack-tracker/snacks-ledger.module';
import { CodingAgentModule } from '../coding-agent/coding-agent.module';
import { EmployeeAssistantAgentRegistrationService } from './services/employee-assistant-agent-registration.service';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    SkillsModule,
    SnacksLedgerModule,
    CodingAgentModule,
  ],
  providers: [EmployeeAssistantAgentRegistrationService],
})
export class EmployeeAssistantModule {}
