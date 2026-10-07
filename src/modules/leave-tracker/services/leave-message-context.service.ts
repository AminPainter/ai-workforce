import { Injectable } from '@nestjs/common';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import type { LeaveMessageJob } from '../queues/leave-tracker.queue';
import {
  formatClassifierInput,
  type ClassifierContextMessage,
} from '../utils/classifier-input';
import {
  cleanSlackText,
  extractMentionedUserIds,
  extractPermalinks,
} from '../utils/slack-text';

export interface SlackPerson {
  userId: string;
  name: string;
  email: string | null;
}

export interface LeaveMessageContext {
  author: SlackPerson;
  classifierInput: string;
}

@Injectable()
export class LeaveMessageContextService {
  constructor(private readonly slackBotService: SlackBotService) {}

  async build(job: LeaveMessageJob, now: Date): Promise<LeaveMessageContext> {
    const author = await this.lookupPerson(job.userId);
    const userNames = new Map<string, string>();
    for (const userId of extractMentionedUserIds(job.rawText))
      userNames.set(userId, (await this.lookupPerson(userId)).name);

    const [, channelId, threadTs] = job.threadId.split(':');
    const parentMessageId = threadTs !== job.messageId ? threadTs : null;

    const contextMessages: ClassifierContextMessage[] = [];
    if (parentMessageId) {
      const parent = await this.contextFromMessage(
        job.threadId,
        parentMessageId,
        job.userId,
        userNames,
        'This message is a reply in a thread. The thread starts with',
      );
      if (parent) contextMessages.push(parent);
    }

    const [permalink] = extractPermalinks(job.rawText, channelId);
    if (permalink && permalink.ts !== parentMessageId) {
      const linked = await this.contextFromMessage(
        `slack:${permalink.channelId}:${permalink.threadTs}`,
        permalink.ts,
        job.userId,
        userNames,
        'This message links to (bumps) an earlier #leaves message',
      );
      if (linked) contextMessages.push(linked);
    }

    return {
      author,
      classifierInput: formatClassifierInput({
        now,
        postedAt: new Date(job.postedAt),
        authorName: author.name,
        authorUserId: job.userId,
        text: cleanSlackText(job.rawText, userNames),
        contextMessages,
      }),
    };
  }

  private async lookupPerson(userId: string): Promise<SlackPerson> {
    const user = await this.slackBotService.getUser(userId);
    return {
      userId,
      name: user?.fullName || user?.userName || userId,
      email: user?.email ?? null,
    };
  }

  private async contextFromMessage(
    threadId: string,
    messageId: string,
    authorUserId: string,
    userNames: Map<string, string>,
    headingPrefix: string,
  ): Promise<ClassifierContextMessage | null> {
    const message = await this.slackBotService.fetchMessage(
      threadId,
      messageId,
    );
    if (!message || message.author.isBot === true) return null;

    const isSameAuthor = message.author.userId === authorUserId;
    const rawText = (message.raw as { text?: string } | undefined)?.text;
    return {
      heading: `${headingPrefix} written by ${isSameAuthor ? 'the same author' : `another person (${message.author.fullName || message.author.userName}); leave in it is NOT the author's`}.`,
      text: cleanSlackText(rawText ?? message.text, userNames),
      postedAt: message.metadata.dateSent,
    };
  }
}
