import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AgentRegistry } from '../../agents/services/agent-registry.service.js';
import { ZohoDeskService } from '../../zoho/services/zoho-desk.service.js';
import type { ZohoCustomFields } from '../../zoho/zoho.types.js';
import { FORM9_CLASSIFIER } from '../agent/form9-classifier.agent.js';
import { buildForm9ClassifyTask } from '../agent/form9-classify-task.js';
import type { Form9Taxonomy } from '../agent/form9-classifier.schema.js';
import { lookupForm9, type Form9Derivation } from '../mapping/form9-mapping.js';
import { FORM9_QUEUE } from '../queues/form9.queue.js';
import type { Form9Job } from '../form9.types.js';

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
            content: buildForm9ClassifyTask(ticket, conversation, new Date()),
          },
        ],
      })) as { output: Form9Taxonomy };

    const derivation = lookupForm9(
      taxonomy.issueType1,
      taxonomy.issueType2,
      taxonomy.issueType3,
      taxonomy.escalated,
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
    if (derivation.convertedToComplaint)
      this.logger.log(
        `ticket ${ticketId} converted from service request to complaint, triggered at ${taxonomy.escalatedAt || 'unknown time'}`,
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
    return {
      cf_form9_reportable: derivation.reportable,
      cf_form9_service_type: derivation.serviceType,
      cf_form9_complaint_type: derivation.complaintType,
      cf_form9_others_detail: derivation.othersDetail || null,
    };
  }
}
