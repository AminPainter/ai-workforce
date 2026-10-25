import { Module } from '@nestjs/common';
import { WebToolsService } from './services/web-tools.service.js';

@Module({
  providers: [WebToolsService],
  exports: [WebToolsService],
})
export class WebModule {}
