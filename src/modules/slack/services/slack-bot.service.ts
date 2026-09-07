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
import {
  SLACK_BAKAR_MESSAGE_EVENT,
  type SlackBakarEvent,
} from '../slack.events';

const ALLOWED_SLACK_USER_IDS = new Set<string>([
  'U0857R1RB9Q', // Amin
  'U072S2RLD4G', // Shreyas
  'U07BD5PE4DQ', // Prabhat
  'U066TUAMKND', // Sahil
  'U09R63QP27J', // Arjun
  'U097N9HA2LF', // Yash
  'U093L589891', // Sahil Yadav
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
  private readonly bakarChannelId: string;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.maxContextMessages = Number(
      this.configService.get('EMPLOYEE_ASSISTANT_MAX_CONTEXT_MESSAGES') ?? 50,
    );
    this.bakarChannelId = `slack:${this.configService.getOrThrow<string>(
      'BAKAR_SLACK_CHANNEL',
    )}`;
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
      if (thread.channelId !== this.bakarChannelId) return;
      this.eventEmitter.emit(SLACK_BAKAR_MESSAGE_EVENT, {
        thread,
        message,
      } satisfies SlackBakarEvent);
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

  private async addSeenReaction(
    message: import('chat').Message,
  ): Promise<void> {
    try {
      await this.slackAdapter.addReaction(
        message.threadId,
        message.id,
        this.emoji.eyes,
      );
    } catch (error) {
      this.logger.warn(`failed to add eyes reaction: ${error}`);
    }
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
    const now = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    return `Current date/time: ${now} IST`;
  }
}
