import { Controller, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { SlackBotService } from '../services/slack-bot.service';
import { LeavesSlackBotService } from '../services/leaves-slack-bot.service';
import { sendWebResponse, toWebRequest } from '../utils/fetch-express';

@Controller('webhooks')
export class SlackWebhookController {
  constructor(
    private readonly slackBotService: SlackBotService,
    private readonly leavesSlackBotService: LeavesSlackBotService,
  ) {}

  @Post('slack')
  async handleSlackWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const request = toWebRequest(req);
    const response = await this.slackBotService.slackWebhook(request);
    await sendWebResponse(res, response);
  }

  @Post('slack/leaves')
  async handleLeavesSlackWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const request = toWebRequest(req);
    const response = await this.leavesSlackBotService.slackWebhook(request);
    await sendWebResponse(res, response);
  }
}
