import { Body, Controller, Post } from '@nestjs/common';

@Controller('webhooks')
export class ZohoWebhookController {
  @Post('zoho')
  handleZohoWebhook(@Body() body: unknown): { ok: true } {
    console.log('Received Zoho webhook', body);
    return { ok: true };
  }
}
