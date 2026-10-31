import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ZOHO_TICKET_THREAD_ADDED } from '../zoho/zoho.events.js';
import type { ZohoTicketThreadAddedEvent } from '../zoho/zoho.types.js';
import { FORM9_QUEUE } from './queues/form9.queue.js';
import type { Form9Job } from './form9.types.js';

@Injectable()
export class Form9Listener {
  private readonly logger = new Logger(Form9Listener.name);

  constructor(
    @InjectQueue(FORM9_QUEUE)
    private readonly form9Queue: Queue,
  ) {}

  @OnEvent(ZOHO_TICKET_THREAD_ADDED)
  async onThreadAdded({
    ticketId,
    threadId,
    orgId,
  }: ZohoTicketThreadAddedEvent): Promise<void> {
    const job: Form9Job = { ticketId, orgId };
    try {
      await this.form9Queue.add('classify', job, {
        jobId: threadId ? `${ticketId}-${threadId}` : ticketId,
      });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
