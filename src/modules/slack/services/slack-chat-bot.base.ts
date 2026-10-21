import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SlackChatOptions {
  userName: string;
  botToken: string;
  signingSecret: string;
  keyPrefix?: string;
  agentView?: boolean;
}

export abstract class SlackChatBot implements OnModuleDestroy {
  protected abstract readonly logger: Logger;
  protected bot!: import('chat').Chat;
  protected slackAdapter!: import('@chat-adapter/slack').SlackAdapter;
  protected emoji!: typeof import('chat').emoji;

  protected constructor(protected readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.bot?.shutdown();
  }

  get slackWebhook() {
    return this.bot.webhooks.slack;
  }

  async postToThread(
    threadId: string,
    message: string | import('chat').ChatElement,
  ): Promise<void> {
    await this.bot.thread(threadId).post(message);
  }

  async postDirectMessage(
    userId: string,
    message: string | import('chat').ChatElement,
  ): Promise<void> {
    const thread = await this.bot.openDM(userId);
    await thread.post(message);
  }

  async lookupUserIdByEmail(email: string): Promise<string | null> {
    try {
      const { user } = await this.slackAdapter.webClient.users.lookupByEmail({
        email,
      });
      return user?.id ?? null;
    } catch (error) {
      this.logger.warn(`no Slack user for email: ${error}`);
      return null;
    }
  }

  async addReaction(
    threadId: string,
    messageId: string,
    emojiName: string,
  ): Promise<void> {
    try {
      await this.slackAdapter.addReaction(threadId, messageId, emojiName);
    } catch (error) {
      this.logger.warn(`failed to add ${emojiName} reaction: ${error}`);
    }
  }

  // Bypasses the adapter's 8-day user cache, which can hold entries fetched
  // before the users:read.email scope was granted.
  async fetchUser(
    userId: string,
  ): Promise<{ name: string | null; email: string | null }> {
    const { user } = await this.slackAdapter.webClient.users.info({
      user: userId,
    });
    return {
      name:
        user?.real_name ||
        user?.profile?.real_name ||
        user?.profile?.display_name ||
        user?.name ||
        null,
      email: user?.profile?.email || null,
    };
  }

  // The Slack adapter sends a backward cursor as conversations.replies
  // `latest` with `inclusive: false`, so a message ts works as the cursor.
  async fetchThreadMessagesBefore(
    threadId: string,
    messageId: string,
    limit: number,
  ): Promise<import('chat').Message[]> {
    try {
      const { messages } = await this.slackAdapter.fetchMessages(threadId, {
        direction: 'backward',
        cursor: messageId,
        limit,
      });
      return messages;
    } catch (error) {
      this.logger.warn(`failed to fetch messages in ${threadId}: ${error}`);
      return [];
    }
  }

  protected async initChat({
    userName,
    botToken,
    signingSecret,
    keyPrefix,
    agentView,
  }: SlackChatOptions): Promise<void> {
    const { Chat, emoji } = await import('chat');
    const { createSlackAdapter } = await import('@chat-adapter/slack');
    const { createRedisState } = await import('@chat-adapter/state-redis');

    this.emoji = emoji;
    this.slackAdapter = createSlackAdapter({
      botToken,
      signingSecret,
      agentView,
    });
    this.bot = new Chat({
      userName,
      adapters: { slack: this.slackAdapter },
      state: createRedisState({
        url: this.configService.getOrThrow<string>('REDIS_URL'),
        keyPrefix,
      }),
    });
  }
}
