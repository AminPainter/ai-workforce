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
import {
  LeaveLedgerService,
  type PendingClarification,
} from './leave-ledger.service';

export interface SlackPerson {
  userId: string;
  name: string;
  email: string | null;
}

export interface LeaveMessageContext {
  author: SlackPerson;
  parentMessageId: string | null;
  pending: PendingClarification | null;
  classifierInput: string;
}

@Injectable()
export class LeaveMessageContextService {
  constructor(
    private readonly slackBotService: SlackBotService,
    private readonly leaveLedgerService: LeaveLedgerService,
  ) {}

  async build(job: LeaveMessageJob, now: Date): Promise<LeaveMessageContext> {
    const author = await this.lookupPerson(job.userId);
    const userNames = new Map<string, string>();
    for (const userId of extractMentionedUserIds(job.rawText))
      userNames.set(userId, (await this.lookupPerson(userId)).name);

    const [, channelId, threadTs] = job.threadId.split(':');
    const parentMessageId = threadTs !== job.messageId ? threadTs : null;
    const pending = parentMessageId
      ? await this.leaveLedgerService.getPendingClarification(
          job.threadId,
          job.userId,
        )
      : null;

    const contextMessages: ClassifierContextMessage[] = [];
    if (pending)
      contextMessages.push({
        heading: `Earlier, the author posted the message below and the bot asked them: "${pending.question}". The current message is their answer.`,
        text: pending.text,
        postedAt: new Date(pending.postedAt),
        recordedEntries: [],
      });
    else if (parentMessageId) {
      const parent = await this.contextFromMessage(
        job.threadId,
        parentMessageId,
        job.userId,
        author.email,
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
        author.email,
        userNames,
        'This message links to (bumps) an earlier #leaves message',
      );
      if (linked) contextMessages.push(linked);
    }

    return {
      author,
      parentMessageId,
      pending,
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
    authorEmail: string | null,
    userNames: Map<string, string>,
    headingPrefix: string,
  ): Promise<ClassifierContextMessage | null> {
    const message = await this.slackBotService.fetchMessage(
      threadId,
      messageId,
    );
    if (!message || message.author.isBot === true) return null;

    const isSameAuthor = message.author.userId === authorUserId;
    const recordedEntries = isSameAuthor
      ? (await this.leaveLedgerService.getRecordedEntries(messageId)).filter(
          (entry) => entry.email === authorEmail,
        )
      : [];
    const rawText = (message.raw as { text?: string } | undefined)?.text;
    return {
      heading: `${headingPrefix} written by ${isSameAuthor ? 'the same author' : `another person (${message.author.fullName || message.author.userName}); leave in it is NOT the author's`}.`,
      text: cleanSlackText(rawText ?? message.text, userNames),
      postedAt: message.metadata.dateSent,
      recordedEntries,
    };
  }
}
