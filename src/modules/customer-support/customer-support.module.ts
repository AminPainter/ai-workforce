import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { ZohoModule } from '../zoho/zoho.module.js';
import { CustomerSupportListener } from './customer-support.listener.js';
import { CustomerSupportProcessor } from './processors/customer-support.processor.js';
import { CustomerSupportAgentRegistrationService } from './services/customer-support-agent-registration.service.js';
import { CUSTOMER_SUPPORT_QUEUE } from './queues/customer-support.queue.js';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    ZohoModule,
    BullModule.registerQueue({ name: CUSTOMER_SUPPORT_QUEUE }),
  ],
  providers: [
    CustomerSupportListener,
    CustomerSupportProcessor,
    CustomerSupportAgentRegistrationService,
  ],
})
export class CustomerSupportModule {}
