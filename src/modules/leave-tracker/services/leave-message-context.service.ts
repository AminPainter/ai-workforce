import { Injectable } from '@nestjs/common';
import { LeavesSlackBotService } from '../../slack/services/leaves-slack-bot.service';
import type { LeaveMessageJob } from '../queues/leave-tracker.queue';
import {
  formatClassifierInput,
  type ThreadMessage,
  ThreadMessageSender,
} from '../utils/classifier-input';

const THREAD_FETCH_LIMIT = 100;
const MAX_EARLIER_THREAD_REPLIES = 20;

export interface SlackPerson {
  name: string;
  email: string | null;
}

export interface LeaveMessageContext {
  author: SlackPerson;
  isThreadReply: boolean;
  classifierInput: string;
}

@Injectable()
export class LeaveMessageContextService {
  constructor(private readonly leavesSlackBotService: LeavesSlackBotService) {}

  async build(job: LeaveMessageJob, now: Date): Promise<LeaveMessageContext> {
    const author = await this.lookupAuthor(job.userId);
    return {
      author,
      isThreadReply: getThreadTimestamp(job) !== job.messageId,
      classifierInput: formatClassifierInput({
        now,
        postedAt: new Date(job.postedAt),
        authorName: author.name,
        authorUserId: job.userId,
        text: job.text,
        earlierThreadMessages: await this.earlierThreadMessages(job, author),
      }),
    };
  }

  private async lookupAuthor(userId: string): Promise<SlackPerson> {
    const { name, email } = await this.leavesSlackBotService.fetchUser(userId);
    return { name: name ?? userId, email };
  }

  private async earlierThreadMessages(
    job: LeaveMessageJob,
    author: SlackPerson,
  ): Promise<ThreadMessage[]> {
    if (getThreadTimestamp(job) === job.messageId) return [];

    const earlier = (
      await this.leavesSlackBotService.fetchThreadMessagesBefore(
        job.threadId,
        job.messageId,
        THREAD_FETCH_LIMIT,
      )
    ).filter((message) => !isFromOtherBot(message) && message.text.trim());
    const [root, ...replies] = earlier;
    if (!root) return [];

    return [root, ...replies.slice(-MAX_EARLIER_THREAD_REPLIES)].map(
      (message) => ({
        sender: getMessageSenderType(message, job.userId),
        name:
          message.author.userId === job.userId
            ? author.name
            : message.author.fullName,
        text: message.text,
        postedAt: message.metadata.dateSent,
      }),
    );
  }
}

function isFromOtherBot(message: import('chat').Message): boolean {
  return message.author.isBot === true && !message.author.isMe;
}

function getMessageSenderType(
  message: import('chat').Message,
  authorUserId: string,
): ThreadMessageSender {
  if (message.author.isMe) return ThreadMessageSender.Bot;
  return message.author.userId === authorUserId
    ? ThreadMessageSender.Author
    : ThreadMessageSender.Other;
}

function getThreadTimestamp(job: LeaveMessageJob): string {
  const [, , threadTimestamp] = job.threadId.split(':');
  return threadTimestamp;
}
