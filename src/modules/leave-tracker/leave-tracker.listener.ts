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

const EMPLOYEES_NOT_ON_RAZORPAYX_PAYROLL = new Set<string>([
  'U09LZ4M5F6J', // Dhruvi Dolia
  'U09ME40GB4H', // Shivani B
  'U09NYEMLT9N', // Ashutosh
  'U09HF87HMFD', // Harsh Singh
]);

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
    if (EMPLOYEES_NOT_ON_RAZORPAYX_PAYROLL.has(message.author.userId)) return;
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
