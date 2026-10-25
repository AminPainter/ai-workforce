import { Controller, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SlackBotService } from '../services/slack-bot.service.js';
import { LeavesSlackBotService } from '../services/leaves-slack-bot.service.js';
import { sendWebResponse, toWebRequest } from '../utils/fetch-fastify.js';

@Controller('webhooks')
export class SlackWebhookController {
  constructor(
    private readonly slackBotService: SlackBotService,
    private readonly leavesSlackBotService: LeavesSlackBotService,
  ) {}

  @Post('slack')
  async handleSlackWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const request = toWebRequest(req);
    const response = await this.slackBotService.slackWebhook(request);
    await sendWebResponse(reply, response);
  }

  @Post('slack/leaves')
  async handleLeavesSlackWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const request = toWebRequest(req);
    const response = await this.leavesSlackBotService.slackWebhook(request);
    await sendWebResponse(reply, response);
  }
}
