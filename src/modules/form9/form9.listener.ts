import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ZOHO_TICKET_CREATED } from '../zoho/zoho.events';
import type { ZohoTicketCreatedEvent } from '../zoho/zoho.types';
import { FORM9_QUEUE } from './queues/form9.queue';
import type { Form9Job } from './form9.types';

@Injectable()
export class Form9Listener {
  private readonly logger = new Logger(Form9Listener.name);

  constructor(
    @InjectQueue(FORM9_QUEUE)
    private readonly form9Queue: Queue,
  ) {}

  @OnEvent(ZOHO_TICKET_CREATED)
  async onTicketCreated({
    ticketId,
    orgId,
  }: ZohoTicketCreatedEvent): Promise<void> {
    const job: Form9Job = { ticketId, orgId };
    try {
      await this.form9Queue.add('classify', job, { jobId: ticketId });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
