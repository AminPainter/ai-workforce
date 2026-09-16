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
  async handleZohoWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-zdesk-jwt') token: string | undefined,
  ): Promise<{ ok: true }> {
    // Zoho sends an unsigned setup/validation request (no X-ZDesk-JWT) when the
    // webhook is registered. Acknowledge it without processing.
    if (!token) {
      this.logger.log('Zoho webhook validation request acknowledged');
      return { ok: true };
    }

    await this.zohoWebhookService.handleWebhook(req.rawBody, token);
    return { ok: true };
  }
}
