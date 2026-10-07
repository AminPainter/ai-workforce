import { Injectable } from '@nestjs/common';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import type { LeaveMessageJob } from '../queues/leave-tracker.queue';
import {
  formatClassifierInput,
  type ThreadParentMessage,
} from '../utils/classifier-input';

export interface SlackPerson {
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
    const author = await this.lookupAuthor(job.userId);
    return {
      author,
      classifierInput: formatClassifierInput({
        now,
        postedAt: new Date(job.postedAt),
        authorName: author.name,
        authorUserId: job.userId,
        text: job.text,
        threadParent: await this.ownThreadParent(job),
      }),
    };
  }

  private async lookupAuthor(userId: string): Promise<SlackPerson> {
    const { name, email } = await this.slackBotService.fetchUser(userId);
    return { name: name ?? userId, email };
  }

  private async ownThreadParent(
    job: LeaveMessageJob,
  ): Promise<ThreadParentMessage | null> {
    const [, , threadTs] = job.threadId.split(':');
    if (threadTs === job.messageId) return null;

    const parent = await this.slackBotService.fetchMessage(
      job.threadId,
      threadTs,
    );
    if (!parent || parent.author.userId !== job.userId) return null;

    return {
      text: parent.text,
      postedAt: parent.metadata.dateSent,
    };
  }
}
