import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SlackModule } from '../slack/slack.module';
import { ContractDriftListener } from './contract-drift.listener';
import { ContractDriftProcessor } from './processors/contract-drift.processor';
import { ContractDriftAgentRegistrationService } from './services/contract-drift-agent-registration.service';
import { ContractDriftNotifierService } from './services/contract-drift-notifier.service';
import { CONTRACT_DRIFT_QUEUE } from './queues/contract-drift.queue';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    SlackModule,
    BullModule.registerQueue({ name: CONTRACT_DRIFT_QUEUE }),
  ],
  providers: [
    ContractDriftListener,
    ContractDriftProcessor,
    ContractDriftAgentRegistrationService,
    ContractDriftNotifierService,
  ],
})
export class ContractDriftModule {}
