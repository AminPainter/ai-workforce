import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { ZohoModule } from '../zoho/zoho.module';
import { CustomerSupportListener } from './customer-support.listener';
import { CustomerSupportProcessor } from './processors/customer-support.processor';
import { CustomerSupportAgentRegistrationService } from './services/customer-support-agent-registration.service';
import { CUSTOMER_SUPPORT_QUEUE } from './queues/customer-support.queue';

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
