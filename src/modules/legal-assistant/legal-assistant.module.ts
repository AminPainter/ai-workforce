import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { RagModule } from '../rag/rag.module';
import { LegalAssistantAgentRegistrationService } from './services/legal-assistant-agent-registration.service';

@Module({
  imports: [AiModule, AgentsModule, RagModule],
  providers: [LegalAssistantAgentRegistrationService],
})
export class LegalAssistantModule {}
