import { Module } from '@nestjs/common';
import { ZohoWebhookController } from './controllers/zoho-webhook.controller.js';
import { ZohoWebhookService } from './services/zoho-webhook.service.js';
import { ZohoDeskService } from './services/zoho-desk.service.js';

@Module({
  controllers: [ZohoWebhookController],
  providers: [ZohoWebhookService, ZohoDeskService],
  exports: [ZohoDeskService],
})
export class ZohoModule {}
