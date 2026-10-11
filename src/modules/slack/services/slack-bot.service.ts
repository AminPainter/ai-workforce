import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT } from '../../employee-assistant/agent/employee-assistant.agent';
import { formatIstDateTime } from '../../../common/utils/date.util';
import {
  SLACK_BAKAR_MESSAGE_EVENT,
  type SlackChannelMessageEvent,
} from '../slack.events';
import { SlackChatBot } from './slack-chat-bot.base';

const ALLOWED_SLACK_USER_IDS = new Set<string>([
  'U0857R1RB9Q', // Amin
  'U072S2RLD4G', // Shreyas
  'U07BD5PE4DQ', // Prabhat
  'U066TUAMKND', // Sahil
  'U09R63QP27J', // Arjun
  'U097N9HA2LF', // Yash
  'U093L589891', // Sahil Yadav
  'U09ME40GB4H', // Shivani
  'U0BACHM9NF5', // Mohan
]);

const UNAUTHORIZED_MESSAGE =
  'I respond only to Master Amin and his product manager Shreyas';

const GENERATION_FAILED_MESSAGE =
  'Having a bad headache. Not able to respond right now. [INTERNAL_SERVER_ERROR]';

@Injectable()
export class SlackBotService extends SlackChatBot implements OnModuleInit {
  protected readonly logger = new Logger(SlackBotService.name);
  private readonly maxContextMessages: number;
  private readonly channelMessageEvents = new Map<string, string>();

  constructor(
    private readonly agentRegistry: AgentRegistry,
    configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(configService);
    this.maxContextMessages = Number(
      this.configService.get('EMPLOYEE_ASSISTANT_MAX_CONTEXT_MESSAGES') ?? 50,
    );
    this.channelMessageEvents.set(
      `slack:${this.configService.getOrThrow<string>('BAKAR_SLACK_CHANNEL')}`,
      SLACK_BAKAR_MESSAGE_EVENT,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.initChat({
      userName: 'glomopay-bot',
      botToken: this.configService.getOrThrow<string>('SLACK_BOT_TOKEN'),
      signingSecret: this.configService.getOrThrow<string>(
        'SLACK_SIGNING_SECRET',
      ),
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
      this.emitChannelMessage(thread, message);
    });
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
