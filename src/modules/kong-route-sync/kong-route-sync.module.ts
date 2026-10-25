import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GitHubModule } from '../github/github.module.js';
import { SlackModule } from '../slack/slack.module.js';
import { KongRouteSyncListener } from './kong-route-sync.listener.js';
import { KongRouteSyncProcessor } from './processors/kong-route-sync.processor.js';
import { KongRouteSyncNotificationProcessor } from './processors/kong-route-sync-notification.processor.js';
import { KongRouteSyncNotifierService } from './services/kong-route-sync-notifier.service.js';
import {
  KONG_ROUTE_SYNC_CODING_QUEUE,
  KONG_ROUTE_SYNC_NOTIFICATION_QUEUE,
  KONG_ROUTE_SYNC_QUEUE,
} from './queues/kong-route-sync.queue.js';

@Module({
  imports: [
    GitHubModule,
    SlackModule,
    BullModule.registerQueue(
      { name: KONG_ROUTE_SYNC_QUEUE },
      { name: KONG_ROUTE_SYNC_CODING_QUEUE },
      { name: KONG_ROUTE_SYNC_NOTIFICATION_QUEUE },
    ),
  ],
  providers: [
    KongRouteSyncListener,
    KongRouteSyncProcessor,
    KongRouteSyncNotificationProcessor,
    KongRouteSyncNotifierService,
  ],
})
export class KongRouteSyncModule {}
