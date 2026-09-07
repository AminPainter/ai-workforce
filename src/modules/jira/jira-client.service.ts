import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdfDoc } from './adf.types';

type JiraCloudClient = ReturnType<typeof import('jira.js').createCloudClient>;

const DEFAULT_JIRA_BASE_URL = 'https://glomopay.atlassian.net';

@Injectable()
export class JiraClientService implements OnModuleInit {
  private client!: JiraCloudClient;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const { createCloudClient } = await import('jira.js');
    this.client = createCloudClient({
      host:
        this.configService.get<string>('ATLASSIAN_BASE_URL') ??
        DEFAULT_JIRA_BASE_URL,
      auth: {
        type: 'basic',
        email: this.configService.getOrThrow<string>('ATLASSIAN_EMAIL'),
        apiToken: this.configService.getOrThrow<string>('ATLASSIAN_API_TOKEN'),
      },
    });
  }

  async getIssueDescription(issueKey: string): Promise<AdfDoc | null> {
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: issueKey,
      fields: ['description'],
    });
    return (issue.fields?.description as AdfDoc | null | undefined) ?? null;
  }

  async setIssueDescription(
    issueKey: string,
    description: AdfDoc,
  ): Promise<void> {
    await this.client.issues.editIssue({
      issueIdOrKey: issueKey,
      fields: { description },
    });
  }
}
