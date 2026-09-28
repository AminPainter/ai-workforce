import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { ZOHO_TICKET_CREATED, ZOHO_TICKET_THREAD_ADDED } from '../zoho.events';
import type {
  ZohoTicketCreatedEvent,
  ZohoTicketThreadAddedEvent,
  ZohoWebhookEvent,
} from '../zoho.types';

const TICKET_THREAD_ADD = 'Ticket_Thread_Add';
const TICKET_ADD = 'Ticket_Add';
const JWKS_URL = 'https://desk.zoho.in/.well-known/jwks.json';

@Injectable()
export class ZohoWebhookService {
  private readonly logger = new Logger(ZohoWebhookService.name);
  private readonly issuer: string;
  private readonly audience?: string;
  private readonly jwksClient: JwksClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.issuer = `orgId:${this.configService.getOrThrow<string>('ZOHO_ORG_ID')}`;
    const webhookId = this.configService.get<string>('ZOHO_WEBHOOK_ID');
    this.audience = webhookId ? `webhookId:${webhookId}` : undefined;
    this.jwksClient = new JwksClient({
      jwksUri: JWKS_URL,
      cache: true,
      rateLimit: true,
    });
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    token: string | undefined,
  ): Promise<void> {
    if (!rawBody) {
      this.logger.warn('missing raw body');
      return;
    }

    if (!(await this.verifyJwt(token))) {
      this.logger.warn('rejected delivery: JWT verification failed');
      return;
    }

    for (const event of this.parseEvents(rawBody)) this.dispatch(event);
  }

  private async verifyJwt(token: string | undefined): Promise<boolean> {
    if (!token) return false;

    try {
      await new Promise((resolve, reject) => {
        jwt.verify(
          token,
          (header, callback) => {
            this.jwksClient.getSigningKey(header.kid, (err, key) => {
              if (err || !key) {
                callback(err ?? new Error('signing key not found'));
                return;
              }
              callback(null, key.getPublicKey());
            });
          },
          {
            algorithms: ['RS256'],
            issuer: this.issuer,
            ...(this.audience ? { audience: this.audience } : {}),
          },
          (err, decoded) => (err ? reject(err) : resolve(decoded)),
        );
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `JWT verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
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
    switch (event.eventType) {
      case TICKET_THREAD_ADD:
        this.dispatchThreadAdd(event);
        return;
      case TICKET_ADD:
        this.dispatchTicketAdd(event);
        return;
      default:
        this.logger.log(`ignoring event ${event.eventType}`);
    }
  }

  private dispatchThreadAdd(event: ZohoWebhookEvent): void {
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

  private dispatchTicketAdd(event: ZohoWebhookEvent): void {
    const payload = event.payload ?? {};
    const ticketId = payload.ticketId ?? payload.id;
    const orgId = event.orgId;
    if (!ticketId || !orgId) {
      this.logger.warn('ticket add event missing ticketId/orgId');
      return;
    }

    this.logger.log(
      `new ticket ${ticketId}, enqueuing draft and Form 9 classification`,
    );
    const emitted: ZohoTicketThreadAddedEvent = { ticketId, orgId };
    this.eventEmitter.emit(ZOHO_TICKET_THREAD_ADDED, emitted);
    const created: ZohoTicketCreatedEvent = { ticketId, orgId };
    this.eventEmitter.emit(ZOHO_TICKET_CREATED, created);
  }
}
