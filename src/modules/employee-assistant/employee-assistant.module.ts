import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { WebModule } from '../web/web.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { SnacksLedgerModule } from '../snack-tracker/snacks-ledger.module.js';
import { CodingAgentModule } from '../coding-agent/coding-agent.module.js';
import { EmployeeAssistantAgentRegistrationService } from './services/employee-assistant-agent-registration.service.js';

@Module({
  imports: [
    AiModule,
    WebModule,
    AgentsModule,
    SkillsModule,
    SnacksLedgerModule,
    CodingAgentModule,
  ],
  providers: [EmployeeAssistantAgentRegistrationService],
})
export class EmployeeAssistantModule {}
