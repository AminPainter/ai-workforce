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
    @Headers() headers: Record<string, string>,
  ): { ok: true } {
    // TEMP DIAGNOSTIC: log what Zoho actually sends so we can pick the right
    // verification scheme (this basic Desk webhook has no HMAC secret field).
    this.logger.log(`Zoho webhook headers: ${JSON.stringify(headers)}`);
    this.logger.log(
      `Zoho webhook body: ${req.rawBody?.toString('utf8') ?? '(none)'}`,
    );

    const signature = headers['x-hook-signature'];
    if (!signature) {
      this.logger.log('Zoho webhook has no x-hook-signature');
      return { ok: true };
    }

    this.zohoWebhookService.handleWebhook(req.rawBody, signature);
    return { ok: true };
  }
}
