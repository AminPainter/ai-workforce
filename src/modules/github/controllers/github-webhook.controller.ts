import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { GitHubWebhookService } from '../services/github-webhook.service';

@Controller('webhooks')
export class GitHubWebhookController {
  constructor(private readonly gitHubWebhookService: GitHubWebhookService) {}

  @Post('github')
  @HttpCode(200)
  handleGitHubWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
  ): { ok: boolean } {
    this.gitHubWebhookService.handlePush(
      req.rawBody,
      signature,
      event,
      deliveryId,
    );
    return { ok: true };
  }
}
