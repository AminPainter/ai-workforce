import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SLACK_LEAVES_MESSAGE_EVENT,
  type SlackLeavesEvent,
} from '../slack.events';
import { SlackChatBot } from './slack-chat-bot.base';

// Separate state namespace so dedupe/locks don't collide with the main bot,
// which can see the same #leaves messages while it is still in the channel.
const LEAVES_STATE_KEY_PREFIX = 'chat-sdk-leaves';

@Injectable()
export class LeavesSlackBotService
  extends SlackChatBot
  implements OnModuleInit
{
  protected readonly logger = new Logger(LeavesSlackBotService.name);
  private readonly leavesChannelId?: string;

  constructor(
    configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(configService);
    const leavesChannel = this.configService.get<string>(
      'LEAVES_SLACK_CHANNEL',
    );
    if (leavesChannel) this.leavesChannelId = `slack:${leavesChannel}`;
  }

  async onModuleInit(): Promise<void> {
    if (!this.leavesChannelId) {
      this.logger.log('LEAVES_SLACK_CHANNEL is not set; leaves bot disabled');
      return;
    }

    await this.initChat({
      userName: 'leaves-bot',
      botToken: this.configService.getOrThrow<string>('LEAVES_SLACK_BOT_TOKEN'),
      signingSecret: this.configService.getOrThrow<string>(
        'LEAVES_SLACK_SIGNING_SECRET',
      ),
      keyPrefix: LEAVES_STATE_KEY_PREFIX,
    });

    this.bot.onNewMention((thread, message) =>
      this.emitLeavesMessage(thread, message),
    );
    this.bot.onNewMessage(/[\s\S]/, (thread, message) =>
      this.emitLeavesMessage(thread, message),
    );
  }

  override get slackWebhook() {
    if (!this.bot)
      return () =>
        Promise.resolve(new Response('leaves bot disabled', { status: 404 }));
    return this.bot.webhooks.slack;
  }

  private emitLeavesMessage(
    thread: import('chat').Thread,
    message: import('chat').Message,
  ): void {
    if (thread.channelId !== this.leavesChannelId) return;
    this.eventEmitter.emit(SLACK_LEAVES_MESSAGE_EVENT, {
      thread,
      message,
    } satisfies SlackLeavesEvent);
  }
}
