import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { ZohoDeskService } from '../../zoho/services/zoho-desk.service';
import type {
  ZohoConversationEntry,
  ZohoCustomFields,
  ZohoTicket,
} from '../../zoho/zoho.types';
import { FORM9_CLASSIFIER } from '../agent/form9-classifier.agent';
import type { Form9Taxonomy } from '../agent/form9-classifier.schema';
import { lookupForm9, type Form9Derivation } from '../mapping/form9-mapping';
import { FORM9_QUEUE } from '../queues/form9.queue';
import type { Form9Job } from '../form9.types';

@Processor(FORM9_QUEUE, { concurrency: 1 })
export class Form9Processor extends WorkerHost {
  private readonly logger = new Logger(Form9Processor.name);

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly zohoDeskService: ZohoDeskService,
  ) {
    super();
  }

  async process(job: Job<Form9Job>): Promise<void> {
    const { ticketId } = job.data;
    this.logger.log(`classifying Form 9 fields for ticket ${ticketId}`);

    const ticket = await this.zohoDeskService.getTicket(ticketId);
    const conversation = await this.zohoDeskService.getConversations(ticketId);

    const { output: taxonomy } = (await this.agentRegistry
      .get(FORM9_CLASSIFIER)
      .generate({
        messages: [
          {
            role: 'user',
            content: this.buildClassifyTask(ticket, conversation),
          },
        ],
      })) as { output: Form9Taxonomy };

    const derivation = lookupForm9(
      taxonomy.issueType1,
      taxonomy.issueType2,
      taxonomy.issueType3,
    );
    if (!derivation) {
      this.logger.error(
        `ticket ${ticketId}: no Form 9 mapping for taxonomy ${taxonomy.issueType1} > ${taxonomy.issueType2} > ${taxonomy.issueType3}`,
      );
      return;
    }

    const cf = this.buildCustomFields(derivation);
    await this.zohoDeskService.updateTicketCustomFields(ticketId, cf);
    this.logger.log(
      `ticket ${ticketId} classified: ${taxonomy.issueType1} > ${taxonomy.issueType2} > ${taxonomy.issueType3} => ${derivation.reportable} / ${derivation.serviceType} / ${derivation.complaintType}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(`job ${job.id} failed: ${err.message}`);
  }

  private buildCustomFields(derivation: Form9Derivation): ZohoCustomFields {
    const othersDetail =
      derivation.complaintType === '13 Others'
        ? [derivation.matchedIssueType2, derivation.matchedIssueType3]
            .filter((part) => part.length > 0)
            .join(' > ')
        : '';
    return {
      cf_form9_reportable: derivation.reportable,
      cf_form9_service_type: derivation.serviceType,
      cf_form9_complaint_type: derivation.complaintType,
      cf_form9_others_detail: othersDetail || null,
    };
  }

  private buildClassifyTask(
    ticket: ZohoTicket,
    conversation: ZohoConversationEntry[],
  ): string {
    const transcript = conversation
      .map((entry) => {
        const who =
          entry.direction === 'in'
            ? 'Customer'
            : entry.direction === 'out'
              ? 'Support'
              : (entry.author ?? entry.type);
        return `${who}: ${entry.content}`;
      })
      .join('\n\n');

    const body =
      transcript ||
      (ticket.description ? `Customer: ${ticket.description}` : '') ||
      '(no conversation content available)';

    return `Ticket subject: ${ticket.subject}

Conversation (oldest to newest):
${body}

Classify this ticket into a taxonomy node (L1 > L2 > L3).`;
  }
}
