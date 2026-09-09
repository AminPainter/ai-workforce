import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, timingSafeEqual } from 'crypto';
import { ZOHO_TICKET_THREAD_ADDED } from '../zoho.events';
import type {
  ZohoTicketThreadAddedEvent,
  ZohoWebhookEvent,
} from '../zoho.types';

const TICKET_THREAD_ADD = 'Ticket_Thread_Add';

@Injectable()
export class ZohoWebhookService {
  private readonly logger = new Logger(ZohoWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.webhookSecret = this.configService.getOrThrow<string>(
      'ZOHO_WEBHOOK_SECRET',
    );
  }

  handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): void {
    if (!rawBody) {
      this.logger.warn('missing raw body');
      return;
    }

    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn('rejected delivery: signature mismatch');
      return;
    }

    for (const event of this.parseEvents(rawBody)) this.dispatch(event);
  }

  private verifySignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean {
    if (!signature) return false;

    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('base64');

    const provided = Buffer.from(signature);
    const computed = Buffer.from(expected);
    return (
      provided.length === computed.length && timingSafeEqual(provided, computed)
    );
  }

  private parseEvents(rawBody: Buffer): ZohoWebhookEvent[] {
    try {
      const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
      return Array.isArray(parsed)
        ? (parsed as ZohoWebhookEvent[])
        : [parsed as ZohoWebhookEvent];
    } catch {
      this.logger.warn('rejected delivery: body is not valid JSON');
      return [];
    }
  }

  private dispatch(event: ZohoWebhookEvent): void {
    if (event.eventType !== TICKET_THREAD_ADD) {
      this.logger.log(`ignoring event ${event.eventType}`);
      return;
    }

    const payload = event.payload ?? {};
    const isIncoming =
      payload.direction === 'in' || payload.direction === 'incoming';
    if (!isIncoming) {
      this.logger.log(
        `ignoring ${payload.direction} thread on ticket ${payload.ticketId}`,
      );
      return;
    }

    const ticketId = payload.ticketId;
    const threadId = payload.threadId ?? payload.id;
    const orgId = event.orgId;
    if (!ticketId || !threadId || !orgId) {
      this.logger.warn('incoming thread event missing ticketId/threadId/orgId');
      return;
    }

    this.logger.log(
      `incoming thread ${threadId} on ticket ${ticketId}, enqueuing draft`,
    );
    const emitted: ZohoTicketThreadAddedEvent = { ticketId, threadId, orgId };
    this.eventEmitter.emit(ZOHO_TICKET_THREAD_ADDED, emitted);
  }
}
