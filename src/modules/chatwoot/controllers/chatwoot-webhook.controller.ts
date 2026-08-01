import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ChatwootWebhookService } from '../services/chatwoot-webhook.service';

@Controller('webhooks')
export class ChatwootWebhookController {
  constructor(
    private readonly chatwootWebhookService: ChatwootWebhookService,
  ) {}

  @Post('chatwoot')
  @HttpCode(200)
  handleChatwootWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-chatwoot-signature') signature: string | undefined,
    @Headers('x-chatwoot-timestamp') timestamp: string | undefined,
    @Headers('x-chatwoot-delivery') deliveryId: string | undefined,
  ): { ok: boolean } {
    this.chatwootWebhookService.handleWebhook(
      req.rawBody,
      signature,
      timestamp,
      deliveryId,
    );
    return { ok: true };
  }
}
