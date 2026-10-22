import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import { EMPLOYEE_ASSISTANT } from '../../employee-assistant/agent/employee-assistant.agent';
import { SnackTool } from '../../snack-tracker/constants/snack-tools';
import { CodingAgentTool } from '../../coding-agent/constants/coding-agent-tools';
import { formatIstDateTime } from '../../../common/utils/date.util';
import {
  SLACK_BAKAR_MESSAGE_EVENT,
  type SlackChannelMessageEvent,
} from '../slack.events';
import { SlackChatBot } from './slack-chat-bot.base';

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
      agentView: true,
    });

    this.bot.onNewMention(async (thread, message) => {
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
    await thread.startTyping();
    const text = await this.generateReply(thread, requesterUserId);
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

  private async generateReply(
    thread: import('chat').Thread,
    requesterUserId: string,
  ): Promise<string> {
    try {
      const history = await this.readThreadHistory(thread);
      const messages = await this.buildModelMessages(history);
      const result = await this.agentRegistry.get(EMPLOYEE_ASSISTANT).generate({
        messages,
        abortSignal: thread.signal,
        toolsContext: {
          [SnackTool.MARK_SNACKS_FULFILLED]: {
            channelId: thread.channelId,
            requesterUserId,
          },
          [CodingAgentTool.DELEGATE_CODING_TASK]: { threadId: thread.id },
        },
      });
      if (result.finishReason === 'tool-calls') {
        this.logger.warn(
          `agent hit the step limit after ${result.steps.length} steps`,
        );
        await thread.post(GENERATION_FAILED_MESSAGE);
        return '';
      }
      if (result.text.trim().length === 0) {
        this.logger.warn('agent produced an empty response');
        await thread.post(GENERATION_FAILED_MESSAGE);
        return '';
      }
      await thread.post({ markdown: result.text });
      return result.text;
    } catch (error) {
      if (thread.signal.aborted) {
        this.logger.log('reply stopped by user');
        return '';
      }
      this.logger.error(`agent reply failed: ${error}`);
      await thread.post(GENERATION_FAILED_MESSAGE);
      return '';
    }
  }

  private datePrefix(): string {
    return `Current date/time: ${formatIstDateTime(new Date())} IST`;
  }
}
