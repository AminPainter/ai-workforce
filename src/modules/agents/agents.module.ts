import { Module } from '@nestjs/common';
import { AgentRegistry } from './services/agent-registry.service';

@Module({
  providers: [AgentRegistry],
  exports: [AgentRegistry],
})
export class AgentsModule {}
