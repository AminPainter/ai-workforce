import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ZohoWebhookService } from '../services/zoho-webhook.service';

@Controller('webhooks')
export class ZohoWebhookController {
  private readonly logger = new Logger(ZohoWebhookController.name);

  constructor(private readonly zohoWebhookService: ZohoWebhookService) {}

  @Post('zoho')
  @HttpCode(200)
  handleZohoWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-hook-signature') signature: string | undefined,
  ): { ok: true } {
    // Zoho sends an unsigned setup/validation request when the webhook is
    // registered. Acknowledge it without processing so registration succeeds.
    if (!signature) {
      this.logger.log('Zoho webhook validation request acknowledged');
      return { ok: true };
    }

    this.zohoWebhookService.handleWebhook(req.rawBody, signature);
    return { ok: true };
  }
}
