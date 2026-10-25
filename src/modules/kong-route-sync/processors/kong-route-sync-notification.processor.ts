import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { KongRouteSyncNotifierService } from '../services/kong-route-sync-notifier.service.js';
import {
  KONG_ROUTE_SYNC_NOTIFICATION_QUEUE,
  type KongRouteSyncNotificationJob,
} from '../queues/kong-route-sync.queue.js';

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
    const prRef = `${pullRequestOnRailsApp.repo}#${pullRequestOnRailsApp.number}`;
    if (result.status === 'no-route-changes') {
      this.logger.log(`${prRef} has no net route changes; not notifying`);
      return;
    }

    this.logger.log(
      `DMing ${pullRequestOnRailsApp.authorUsername} about ${result.kongPrUrl} for ${prRef}`,
    );
    await this.kongRouteSyncNotifierService.notifyAuthor(
      { pullRequestOnRailsApp, kongPrUrl: result.kongPrUrl },
      authorEmail,
    );
    this.logger.log(
      `DMed ${pullRequestOnRailsApp.authorUsername} for ${prRef}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<KongRouteSyncNotificationJob> | undefined,
    error: Error,
  ): void {
    this.logger.error(
      `job ${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`,
      error.stack,
    );
  }
}
