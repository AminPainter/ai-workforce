import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlackBotService } from './slack-bot.service';
import {
  buildContractDriftCard,
  type ContractDriftContext,
} from '../templates/contract-drift.template';
import type { ContractDriftReport } from '../../agents/workforce/contract-drift-detector/contract-drift-detector.schema';

@Injectable()
export class SlackNotifierService {
  private readonly logger = new Logger(SlackNotifierService.name);

  constructor(
    private readonly slackBotService: SlackBotService,
    private readonly configService: ConfigService,
  ) {}

  async notifyContractDrift(
    report: ContractDriftReport,
    context: ContractDriftContext,
  ): Promise<void> {
    const channel = this.configService.get<string>(
      'CONTRACT_DRIFT_SLACK_CHANNEL',
    );
    if (!channel) {
      this.logger.warn(
        'CONTRACT_DRIFT_SLACK_CHANNEL is not set; skipping Slack notification',
      );
      return;
    }

    try {
      const card = await buildContractDriftCard(report, context);
      await this.slackBotService.postToChannel(channel, card);
      this.logger.log(
        `posted contract drift alert for ${context.repoFullName}@${context.shortSha} to ${channel}`,
      );
    } catch (error) {
      this.logger.error(
        `failed to post contract drift alert: ${(error as Error).message}`,
      );
    }
  }
}
