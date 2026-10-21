import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlackBotService } from '../../slack/services/slack-bot.service';
import { githubSlackUserMap } from '../kong-route-sync.config';
import {
  buildKongRouteSyncDirectMessage,
  type KongRouteSyncSummary,
} from '../templates/kong-route-sync.template';

@Injectable()
export class KongRouteSyncNotifierService {
  private readonly logger = new Logger(KongRouteSyncNotifierService.name);
  private readonly githubSlackUserMap: Map<string, string>;

  constructor(
    private readonly slackBotService: SlackBotService,
    configService: ConfigService,
  ) {
    this.githubSlackUserMap = githubSlackUserMap(configService);
  }

  async notifyAuthor(
    summary: KongRouteSyncSummary,
    authorEmail: string | null,
  ): Promise<void> {
    const { authorLogin } = summary.pullRequestOnRailsApp;
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
