import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { ZohoModule } from '../zoho/zoho.module';
import { Form9Listener } from './form9.listener';
import { Form9Processor } from './processors/form9.processor';
import { Form9AgentRegistrationService } from './services/form9-agent-registration.service';
import { FORM9_QUEUE } from './queues/form9.queue';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    ZohoModule,
    BullModule.registerQueue({ name: FORM9_QUEUE }),
  ],
  providers: [Form9Listener, Form9Processor, Form9AgentRegistrationService],
})
export class Form9Module {}
