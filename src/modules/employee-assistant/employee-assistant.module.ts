import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { EmployeeAssistantAgentRegistrationService } from './services/employee-assistant-agent-registration.service';

@Module({
  imports: [AiModule, AgentsModule],
  providers: [EmployeeAssistantAgentRegistrationService],
})
export class EmployeeAssistantModule {}
