import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { GlomopayAgentRegistrationService } from './services/glomopay-agent-registration.service';

@Module({
  imports: [AiModule, AgentsModule],
  providers: [GlomopayAgentRegistrationService],
})
export class GlomopayAgentModule {}
