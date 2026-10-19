import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import { githubSlackUserMap, slackChannel } from '../kong-route-sync.config';
import {
  buildKongRouteSyncChannelMessage,
  buildKongRouteSyncDirectMessage,
  type KongRouteSyncSummary,
} from '../templates/kong-route-sync.template';

@Injectable()
export class KongRouteSyncNotifierService {
  private readonly logger = new Logger(KongRouteSyncNotifierService.name);
  private readonly slackChannel: string;
  private readonly githubSlackUserMap: Map<string, string>;

  constructor(
    private readonly slackBotService: SlackBotService,
    configService: ConfigService,
  ) {
    this.slackChannel = slackChannel(configService);
    this.githubSlackUserMap = githubSlackUserMap(configService);
  }

  async notifyChannel(summary: KongRouteSyncSummary): Promise<void> {
    await this.slackBotService.postToChannel(
      this.slackChannel,
      buildKongRouteSyncChannelMessage(summary),
    );
  }

  async notifyAuthor(
    summary: KongRouteSyncSummary,
    authorEmail: string | null,
  ): Promise<void> {
    const { authorLogin } = summary.pullRequest;
    const slackUserId =
      this.githubSlackUserMap.get(authorLogin.toLowerCase()) ??
      (authorEmail &&
        (await this.slackBotService.lookupUserIdByEmail(authorEmail)));
    if (!slackUserId) {
      this.logger.warn(
        `no Slack user for GitHub ${authorLogin}; add them to GITHUB_SLACK_USER_MAP`,
      );
      return;
    }

    await this.slackBotService.postDirectMessage(
      slackUserId,
      buildKongRouteSyncDirectMessage(summary),
    );
  }
}
