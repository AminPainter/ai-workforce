import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  chatwootWebhookPayloadSchema,
  type ChatwootWebhookPayload,
} from '../chatwoot.schema';
import {
  CHATWOOT_MESSAGE_CREATED_EVENT,
  type ChatwootMessageCreatedEvent,
} from '../chatwoot.events';

@Injectable()
export class ChatwootWebhookService {
  private readonly logger = new Logger(ChatwootWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.webhookSecret = this.configService.getOrThrow<string>(
      'CHATWOOT_WEBHOOK_SECRET',
    );
  }

  handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    deliveryId: string | undefined,
  ): void {
    if (!rawBody || !signature || !timestamp) {
      this.logger.warn('missing body, signature, or timestamp header');
      return;
    }
    if (!this.isValidSignature(rawBody, timestamp, signature)) {
      this.logger.warn('rejected delivery: invalid signature');
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody.toString('utf8'));
    } catch {
      this.logger.warn('rejected delivery: invalid JSON body');
      return;
    }

    if ((json as { event?: string }).event !== 'message_created') return;

    const parsed = chatwootWebhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      this.logger.warn(
        `unparseable message_created payload: ${parsed.error.message}`,
      );
      return;
    }
    const payload = parsed.data;
    if (!this.isQualifyingMessage(payload)) return;

    const event: ChatwootMessageCreatedEvent = {
      deliveryId: deliveryId ?? '',
      conversationId: payload.conversation.id,
      status: payload.conversation.status,
      payload,
    };
    this.logger.log(
      `qualifying message on conversation #${event.conversationId} (${(payload.content ?? '').length} chars)`,
    );
    this.eventEmitter.emit(CHATWOOT_MESSAGE_CREATED_EVENT, event);
  }

  private isQualifyingMessage(payload: ChatwootWebhookPayload): boolean {
    return (
      payload.message_type === 'incoming' &&
      payload.private !== true &&
      (payload.content ?? '').trim().length > 0
    );
  }

  private isValidSignature(
    rawBody: Buffer,
    timestamp: string,
    signature: string,
  ): boolean {
    const expected = `sha256=${createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex')}`;
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
