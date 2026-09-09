import { Module } from '@nestjs/common';
import { ZohoWebhookController } from './controllers/zoho-webhook.controller';
import { ZohoWebhookService } from './services/zoho-webhook.service';
import { ZohoDeskService } from './services/zoho-desk.service';

@Module({
  controllers: [ZohoWebhookController],
  providers: [ZohoWebhookService, ZohoDeskService],
  exports: [ZohoDeskService],
})
export class ZohoModule {}
