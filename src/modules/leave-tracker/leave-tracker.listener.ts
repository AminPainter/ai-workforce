import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SLACK_LEAVES_MESSAGE_EVENT,
  type SlackLeavesEvent,
} from '../slack/slack.events';
import {
  LEAVE_TRACKER_QUEUE,
  type LeaveMessageJob,
} from './queues/leave-tracker.queue';

@Injectable()
export class LeaveTrackerListener {
  private readonly logger = new Logger(LeaveTrackerListener.name);

  constructor(
    @InjectQueue(LEAVE_TRACKER_QUEUE)
    private readonly leaveTrackerQueue: Queue,
  ) {}

  @OnEvent(SLACK_LEAVES_MESSAGE_EVENT)
  async onLeavesMessage({ message }: SlackLeavesEvent): Promise<void> {
    if (message.author.isBot === true || message.author.isMe) return;
    const text = message.text?.trim();
    if (!text) return;

    try {
      await this.leaveTrackerQueue.add(
        'leave-message',
        {
          threadId: message.threadId,
          messageId: message.id,
          text,
          userId: message.author.userId,
          postedAt: message.metadata.dateSent.toISOString(),
        } satisfies LeaveMessageJob,
        { jobId: message.id },
      );
    } catch (error) {
      this.logger.error(`failed to enqueue leave message: ${error}`);
    }
  }
}
