import { Injectable } from '@nestjs/common';
import { SlackBotService } from '../../slack/services/slack-bot.service.js';
import {
  buildKongRouteSyncDirectMessage,
  type KongRouteSyncSummary,
} from '../templates/kong-route-sync.template.js';

@Injectable()
export class KongRouteSyncNotifierService {
  constructor(private readonly slackBotService: SlackBotService) {}

  async notifyAuthor(
    summary: KongRouteSyncSummary,
    authorEmail: string,
  ): Promise<void> {
    const slackUserId =
      await this.slackBotService.lookupUserIdByEmail(authorEmail);
    await this.slackBotService.postDirectMessage(
      slackUserId,
      buildKongRouteSyncDirectMessage(summary),
    );
  }
}
