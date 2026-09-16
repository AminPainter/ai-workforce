import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ZOHO_TICKET_THREAD_ADDED } from '../zoho/zoho.events';
import type { ZohoTicketThreadAddedEvent } from '../zoho/zoho.types';
import { CUSTOMER_SUPPORT_QUEUE } from './queues/customer-support.queue';
import type { CustomerSupportJob } from './customer-support.types';

@Injectable()
export class CustomerSupportListener {
  private readonly logger = new Logger(CustomerSupportListener.name);

  constructor(
    @InjectQueue(CUSTOMER_SUPPORT_QUEUE)
    private readonly customerSupportQueue: Queue,
  ) {}

  @OnEvent(ZOHO_TICKET_THREAD_ADDED)
  async onTicketThreadAdded({
    ticketId,
    threadId,
    orgId,
  }: ZohoTicketThreadAddedEvent): Promise<void> {
    const job: CustomerSupportJob = { ticketId, threadId, orgId };
    try {
      await this.customerSupportQueue.add('draft', job, { jobId: threadId });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
