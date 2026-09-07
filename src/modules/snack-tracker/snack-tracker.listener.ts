import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SLACK_BAKAR_MESSAGE_EVENT,
  type SlackBakarEvent,
} from '../slack/slack.events';
import {
  SNACK_TRACKER_QUEUE,
  type SnacksPledgeJob,
} from './queues/snack-tracker.queue';

@Injectable()
export class SnackTrackerListener {
  private readonly logger = new Logger(SnackTrackerListener.name);

  constructor(
    @InjectQueue(SNACK_TRACKER_QUEUE)
    private readonly snackTrackerQueue: Queue,
  ) {}

  @OnEvent(SLACK_BAKAR_MESSAGE_EVENT)
  async onBakarMessage({ message }: SlackBakarEvent): Promise<void> {
    if (message.author.isBot === true || message.author.isMe) return;
    const text = message.text?.trim();
    if (!text) return;

    try {
      await this.snackTrackerQueue.add(
        'pledge',
        {
          threadId: message.threadId,
          messageId: message.id,
          text,
          userId: message.author.userId,
          userName: message.author.userName,
          fullName: message.author.fullName,
        } satisfies SnacksPledgeJob,
        { jobId: message.id },
      );
    } catch (error) {
      this.logger.error(`failed to enqueue snacks pledge: ${error}`);
    }
  }
}
