import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT } from '../../employee-assistant/agent/employee-assistant.agent';
import { formatIstDateTime } from '../../../common/utils/date.util';
import {
  SLACK_BAKAR_MESSAGE_EVENT,
  SLACK_LEAVES_MESSAGE_EVENT,
  type SlackChannelMessageEvent,
} from '../slack.events';

const ALLOWED_SLACK_USER_IDS = new Set<string>([
  'U0857R1RB9Q', // Amin
  'U072S2RLD4G', // Shreyas
  'U07BD5PE4DQ', // Prabhat
  'U066TUAMKND', // Sahil
  'U09R63QP27J', // Arjun
  'U097N9HA2LF', // Yash
  'U093L589891', // Sahil Yadav
  'U09ME40GB4H', // Shivani
]);

const UNAUTHORIZED_MESSAGE =
  'I respond only to Master Amin and his product manager Shreyas';

const GENERATION_FAILED_MESSAGE =
  'Having a bad headache. Not able to respond right now. [INTERNAL_SERVER_ERROR]';

@Injectable()
export class SlackBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlackBotService.name);
  private bot!: import('chat').Chat;
  private slackAdapter!: import('chat').Adapter;
  private emoji!: typeof import('chat').emoji;
  private readonly maxContextMessages: number;
  private readonly leavesChannelId?: string;
  private readonly channelMessageEvents = new Map<string, string>();

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.maxContextMessages = Number(
      this.configService.get('EMPLOYEE_ASSISTANT_MAX_CONTEXT_MESSAGES') ?? 50,
    );
    this.channelMessageEvents.set(
      `slack:${this.configService.getOrThrow<string>('BAKAR_SLACK_CHANNEL')}`,
      SLACK_BAKAR_MESSAGE_EVENT,
    );
    const leavesChannel = this.configService.get<string>(
      'LEAVES_SLACK_CHANNEL',
    );
    if (leavesChannel) {
      this.leavesChannelId = `slack:${leavesChannel}`;
      this.channelMessageEvents.set(
        this.leavesChannelId,
        SLACK_LEAVES_MESSAGE_EVENT,
      );
    }
  }

  async onModuleInit(): Promise<void> {
    const { Chat, emoji } = await import('chat');
    const { createSlackAdapter } = await import('@chat-adapter/slack');
    const { createRedisState } = await import('@chat-adapter/state-redis');

    this.emoji = emoji;
    this.slackAdapter = createSlackAdapter();

    this.bot = new Chat({
      userName: 'glomopay-bot',
      adapters: { slack: this.slackAdapter },
      state: createRedisState({
        url: this.configService.getOrThrow<string>('REDIS_URL'),
      }),
    });

    this.bot.onNewMention(async (thread, message) => {
      if (thread.channelId === this.leavesChannelId) {
        this.emitChannelMessage(thread, message);
        return;
      }
      if (!this.isMessageAuthorAllowedToInteract(message)) {
        this.logger.warn(`ignored mention from ${message.author.userId}`);
        await thread.post(UNAUTHORIZED_MESSAGE);
        return;
      }
      this.logger.log(`mention: ${message.text}`);
      await this.addSeenReaction(message);
      await this.answer(thread, message.author.userId);
    });

    this.bot.onNewMessage(/[\s\S]/, (thread, message) => {
      this.emitChannelMessage(thread, message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot?.shutdown();
  }

  get slackWebhook() {
    return this.bot.webhooks.slack;
  }

  async postToChannel(
    channelId: string,
    message: string | import('chat').ChatElement,
  ): Promise<void> {
    const qualifiedChannelId = channelId.includes(':')
      ? channelId
      : `slack:${channelId}`;
    await this.bot.channel(qualifiedChannelId).post(message);
  }

  async postToThread(
    threadId: string,
    message: string | import('chat').ChatElement,
  ): Promise<void> {
    await this.bot.thread(threadId).post(message);
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

  async getUser(userId: string): Promise<import('chat').UserInfo | null> {
    return this.bot.getUser(userId);
  }

  async fetchMessage(
    threadId: string,
    messageId: string,
  ): Promise<import('chat').Message | null> {
    if (!this.slackAdapter.fetchMessage) return null;
    try {
      return await this.slackAdapter.fetchMessage(threadId, messageId);
    } catch (error) {
      this.logger.warn(
        `failed to fetch message ${messageId} in ${threadId}: ${error}`,
      );
      return null;
    }
  }

  private emitChannelMessage(
    thread: import('chat').Thread,
    message: import('chat').Message,
  ): void {
    const event = this.channelMessageEvents.get(thread.channelId);
    if (!event) return;
    this.eventEmitter.emit(event, {
      thread,
      message,
    } satisfies SlackChannelMessageEvent);
  }

  private async addSeenReaction(
    message: import('chat').Message,
  ): Promise<void> {
    await this.addReaction(message.threadId, message.id, this.emoji.eyes.name);
  }

  private async answer(
    thread: import('chat').Thread,
    requesterUserId: string,
  ): Promise<void> {
    const history = await this.readThreadHistory(thread);
    const messages = await this.buildModelMessages(history);
    const text = await this.streamReply(thread, messages, requesterUserId);
    if (text.trim().length > 0)
      this.logger.log(`answered: ${text.length} chars`);
  }

  private async readThreadHistory(
    thread: import('chat').Thread,
  ): Promise<import('chat').Message[]> {
    const history: import('chat').Message[] = [];
    for await (const msg of thread.allMessages) history.push(msg);
    return history;
  }

  private async buildModelMessages(
    history: import('chat').Message[],
  ): Promise<import('chat/ai').AiMessage[]> {
    const { toAiMessages } = await import('chat/ai');
    const messages = await toAiMessages(
      history.slice(-this.maxContextMessages),
      { includeNames: true },
    );
    messages.unshift({ role: 'user', content: this.datePrefix() });
    return messages;
  }

  private async streamReply(
    thread: import('chat').Thread,
    messages: import('chat/ai').AiMessage[],
    requesterUserId: string,
  ): Promise<string> {
    let sentMessage: import('chat').SentMessage | undefined;
    try {
      const result = await this.agentRegistry.get(EMPLOYEE_ASSISTANT).stream({
        messages,
        toolsContext: {
          markSnacksFulfilled: {
            channelId: thread.channelId,
            requesterUserId,
          },
        },
      });
      sentMessage = await thread.post(result.stream);
      const text = await result.text;
      if (text.trim().length === 0) {
        this.logger.warn('agent produced an empty response');
        await sentMessage.edit(GENERATION_FAILED_MESSAGE);
        return '';
      }
      return text;
    } catch (error) {
      this.logger.error(`agent reply failed: ${error}`);
      if (sentMessage) await sentMessage.edit(GENERATION_FAILED_MESSAGE);
      else await thread.post(GENERATION_FAILED_MESSAGE);
      return '';
    }
  }

  private isMessageAuthorAllowedToInteract(
    message: import('chat').Message,
  ): boolean {
    return ALLOWED_SLACK_USER_IDS.has(message.author.userId);
  }

  private datePrefix(): string {
    return `Current date/time: ${formatIstDateTime(new Date())} IST`;
  }
}
