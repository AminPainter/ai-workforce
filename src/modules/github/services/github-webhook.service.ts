import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Webhooks } from '@octokit/webhooks';
import {
  CONTRACT_DRIFT_QUEUE,
  type PushPayload,
} from '../queues/contract-drift.queue';

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);
  private readonly webhooks: Webhooks;
  private readonly repoAllowlist: Set<string>;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(CONTRACT_DRIFT_QUEUE)
    private readonly contractDriftQueue: Queue,
  ) {
    this.webhooks = new Webhooks({
      secret: this.configService.getOrThrow<string>('GITHUB_WEBHOOK_SECRET'),
    });
    this.repoAllowlist = new Set(
      (this.configService.get<string>('GITHUB_WEBHOOK_REPOS') ?? '')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
    );

    this.webhooks.on('push', ({ id, payload }) => this.onPush(id, payload));
  }

  handlePush(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    event: string | undefined,
    deliveryId: string | undefined,
  ): void {
    if (!rawBody || !signature || !event) {
      this.logger.warn('missing body, signature, or event header');
      return;
    }

    void this.webhooks
      .verifyAndReceive({
        id: deliveryId ?? '',
        name: event,
        payload: rawBody.toString('utf8'),
        signature,
      })
      .catch((error) =>
        this.logger.warn(`rejected delivery: ${errorMessage(error)}`),
      );
  }

  private onPush(id: string, payload: PushPayload): void {
    if (payload.ref !== 'refs/heads/main') {
      this.logger.debug(`ignored ref: ${payload.ref}`);
      return;
    }

    const fullName = payload.repository.full_name;
    if (this.repoAllowlist.size > 0 && !this.repoAllowlist.has(fullName)) {
      this.logger.debug(`ignored repo: ${fullName}`);
      return;
    }

    void this.contractDriftQueue
      .add('analyze', { payload }, { jobId: id })
      .catch((error) => this.logger.error(error));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
