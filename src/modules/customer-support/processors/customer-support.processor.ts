import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { ZohoDeskService } from '../../zoho/services/zoho-desk.service';
import type { ZohoConversationEntry, ZohoTicket } from '../../zoho/zoho.types';
import { CUSTOMER_SUPPORT } from '../agent/customer-support.agent';
import { CUSTOMER_SUPPORT_QUEUE } from '../queues/customer-support.queue';
import type {
  CustomerSupportDraft,
  CustomerSupportJob,
} from '../customer-support.types';

@Processor(CUSTOMER_SUPPORT_QUEUE, {
  concurrency: 1,
})
export class CustomerSupportProcessor extends WorkerHost {
  private readonly logger = new Logger(CustomerSupportProcessor.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly zohoDeskService: ZohoDeskService,
  ) {
    super();
  }

  async process(job: Job<CustomerSupportJob>): Promise<void> {
    const { ticketId } = job.data;
    this.logger.log(`drafting reply for ticket ${ticketId}`);

    const ticket = await this.zohoDeskService.getTicket(ticketId);
    const conversation = await this.zohoDeskService.getConversations(ticketId);

    const { output: draft } = (await this.agentRegistry
      .get(CUSTOMER_SUPPORT)
      .generate({
        messages: [
          { role: 'user', content: buildDraftTask(ticket, conversation) },
        ],
      })) as { output: CustomerSupportDraft };

    await this.zohoDeskService.addPrivateComment(ticketId, {
      content: draft.customerReply,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(`job ${job.id} failed: ${err.message}`);
  }
}

function buildDraftTask(
  ticket: ZohoTicket,
  conversation: ZohoConversationEntry[],
): string {
  const transcript = conversation
    .map((entry) => {
      const who =
        entry.direction === 'incoming'
          ? 'Customer'
          : entry.direction === 'outgoing'
            ? 'Support'
            : (entry.author ?? entry.type);
      return `${who}: ${entry.content}`;
    })
    .join('\n\n');

  return [
    `Ticket subject: ${ticket.subject}`,
    ``,
    `Conversation (oldest to newest):`,
    transcript || '(no conversation content available)',
    ``,
    `Write a draft reply to the newest customer message. Research with your tools first, then draft.`,
  ].join('\n');
}
