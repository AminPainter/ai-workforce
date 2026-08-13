import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT } from '../../employee-assistant/agent/employee-assistant.agent';

const ALLOWED_SLACK_USER_IDS = new Set<string>([
  'U0857R1RB9Q', // Amin
  'U072S2RLD4G', // Shreyas
  'U07BD5PE4DQ', // Prabhat
  'U066TUAMKND', // Sahil
  'U09R63QP27J', // Arjun
  'U097N9HA2LF', // Yash
]);

const UNAUTHORIZED_MESSAGE =
  'I respond only to Master Amin and his product manager Shreyas';

@Injectable()
export class SlackBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlackBotService.name);
  private bot!: import('chat').Chat;
  private slackAdapter!: import('chat').Adapter;
  private emoji!: typeof import('chat').emoji;
  private readonly maxContextMessages: number;

  constructor(
    private readonly agentRegistry: AgentRegistry,
    private readonly configService: ConfigService,
  ) {
    this.maxContextMessages = Number(
      this.configService.get('EMPLOYEE_ASSISTANT_MAX_CONTEXT_MESSAGES') ?? 50,
    );
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
      await this.answer(thread);
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

  private async answer(thread: import('chat').Thread): Promise<void> {
    const history = await this.readThreadHistory(thread);
    const messages = await this.buildModelMessages(history);
    const text = await this.streamReply(thread, messages);
    if (text.trim().length > 0)
      this.logger.log(`answered: ${text.length} chars`);
    else this.logger.warn('agent produced an empty response');
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
  ): Promise<string> {
    const result = await this.agentRegistry
      .get(EMPLOYEE_ASSISTANT)
      .stream({ messages });
    await thread.post(result.stream);
    return result.text;
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
