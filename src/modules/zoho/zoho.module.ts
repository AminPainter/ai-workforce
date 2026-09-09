import { Module } from '@nestjs/common';
import { ZohoWebhookController } from './controllers/zoho-webhook.controller';

@Module({
  controllers: [ZohoWebhookController],
})
export class ZohoModule {}
