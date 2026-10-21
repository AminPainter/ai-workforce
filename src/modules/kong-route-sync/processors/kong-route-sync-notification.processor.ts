import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KongRouteSyncNotifierService } from '../services/kong-route-sync-notifier.service';
import {
  KONG_ROUTE_SYNC_NOTIFICATION_QUEUE,
  type KongRouteSyncNotificationJob,
} from '../queues/kong-route-sync.queue';

@Processor(KONG_ROUTE_SYNC_NOTIFICATION_QUEUE)
export class KongRouteSyncNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(KongRouteSyncNotificationProcessor.name);

  constructor(
    private readonly kongRouteSyncNotifierService: KongRouteSyncNotifierService,
  ) {
    super();
  }

  async process(job: Job<KongRouteSyncNotificationJob>): Promise<void> {
    const { pullRequestOnRailsApp, authorEmail, result } = job.data;
    if (result.status === 'no-route-changes') {
      this.logger.log(
        `${pullRequestOnRailsApp.repo}#${pullRequestOnRailsApp.number} has no net route changes; not notifying`,
      );
      return;
    }

    const summary = {
      pullRequestOnRailsApp,
      routesAdded: result.routesAdded,
      routesRemoved: result.routesRemoved,
      kongPrUrl: result.kongPrUrl,
    };
    await this.kongRouteSyncNotifierService.notifyAuthor(summary, authorEmail);
  }
}
