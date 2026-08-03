import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CHATWOOT_MESSAGE_CREATED_EVENT,
  type ChatwootMessageCreatedEvent,
} from './chatwoot.events';
import { CHATWOOT_QUEUE, type ChatwootDraftJob } from './queues/chatwoot.queue';

@Injectable()
export class ChatwootListener {
  private readonly logger = new Logger(ChatwootListener.name);

  constructor(
    @InjectQueue(CHATWOOT_QUEUE)
    private readonly chatwootQueue: Queue<ChatwootDraftJob>,
  ) {}

  @OnEvent(CHATWOOT_MESSAGE_CREATED_EVENT)
  async onMessageCreated(event: ChatwootMessageCreatedEvent): Promise<void> {
    try {
      await this.chatwootQueue.add('draft', event, {
        jobId: event.deliveryId || undefined,
      });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
