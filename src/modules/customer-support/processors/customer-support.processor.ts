import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  ZohoDeskService,
  type ZohoConversationEntry,
  type ZohoTicket,
} from '../../zoho/services/zoho-desk.service';
import { CUSTOMER_SUPPORT } from '../agent/customer-support.agent';
import { DRAFT_SANITIZER } from '../agent/draft-sanitizer.agent';
import type { CustomerSupportDraft } from '../agent/customer-support.schema';
import type { DraftSanitizerResult } from '../agent/draft-sanitizer.schema';
import {
  CUSTOMER_SUPPORT_QUEUE,
  type CustomerSupportJob,
} from '../queues/customer-support.queue';

const CUSTOMER_SUPPORT_CONCURRENCY = Number(
  process.env.CUSTOMER_SUPPORT_CONCURRENCY ?? 1,
);

// Backstop patterns that must never reach a customer draft, even after the
// sanitizer pass. If any matches, the draft is blocked for human review.
const HARD_GUARDS: { label: string; pattern: RegExp }[] = [
  { label: 'card/PAN number', pattern: /\b(?:\d[ -]?){13,19}\b/ },
  { label: 'JWT', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { label: 'API key', pattern: /\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}\b/ },
];

@Processor(CUSTOMER_SUPPORT_QUEUE, {
  concurrency: CUSTOMER_SUPPORT_CONCURRENCY,
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

    const recipient = ticket.email ?? ticket.contactEmail;
    if (!recipient) {
      this.logger.warn(
        `ticket ${ticketId}: no customer email on record, skipping draft`,
      );
      return;
    }

    const { output: draft } = (await this.agentRegistry
      .get(CUSTOMER_SUPPORT)
      .generate({
        messages: [
          { role: 'user', content: buildDraftTask(ticket, conversation) },
        ],
      })) as { output: CustomerSupportDraft };

    if (draft.escalate)
      this.logger.warn(
        `ticket ${ticketId}: agent escalated — ${draft.escalateReason}`,
      );

    const { output: sanitized } = (await this.agentRegistry
      .get(DRAFT_SANITIZER)
      .generate({
        messages: [{ role: 'user', content: draft.customerReply }],
      })) as { output: DraftSanitizerResult };

    if (!sanitized.safe) {
      this.logger.error(
        `ticket ${ticketId}: draft blocked, sanitizer flagged ${sanitized.violations.length} violation(s) — not storing`,
      );
      return;
    }

    const finalReply = sanitized.revisedDraft;
    const tripped = HARD_GUARDS.filter((guard) =>
      guard.pattern.test(finalReply),
    );
    if (tripped.length > 0) {
      this.logger.error(
        `ticket ${ticketId}: draft blocked by hard guard(s): ${tripped
          .map((guard) => guard.label)
          .join(', ')} — not storing`,
      );
      return;
    }

    await this.zohoDeskService.createDraftReply(ticketId, {
      to: recipient,
      content: finalReply,
      contentType: draft.contentType,
      channel: ticket.channel === 'EMAIL' ? 'EMAIL' : undefined,
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
