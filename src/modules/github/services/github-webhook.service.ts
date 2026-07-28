import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Webhooks } from '@octokit/webhooks';
import {
  GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT,
  type GitHubPullRequestMergedToMainEvent,
} from '../github.events';

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);
  private readonly webhooks: Webhooks;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.webhooks = new Webhooks({
      secret: this.configService.getOrThrow<string>('GITHUB_WEBHOOK_SECRET'),
    });

    this.webhooks.on('pull_request.closed', ({ id, payload }) => {
      const pullRequest = payload.pull_request;
      if (!pullRequest.merged || pullRequest.base.ref !== 'main') {
        this.logger.debug(
          `ignored closed PR #${pullRequest.number} (merged=${pullRequest.merged}, base=${pullRequest.base.ref})`,
        );
        return;
      }

      const event: GitHubPullRequestMergedToMainEvent = { id, payload };
      this.eventEmitter.emit(GITHUB_PULL_REQUEST_MERGED_TO_MAIN_EVENT, event);
    });
  }

  handleWebhook(
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
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
