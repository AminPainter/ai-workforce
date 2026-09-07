import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdfDoc } from './snacks-ledger-adf';

const DEFAULT_JIRA_BASE_URL = 'https://glomopay.atlassian.net';

@Injectable()
export class JiraClientService {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('ATLASSIAN_BASE_URL') ??
      DEFAULT_JIRA_BASE_URL;
    const email = this.configService.getOrThrow<string>('ATLASSIAN_EMAIL');
    const apiToken = this.configService.getOrThrow<string>(
      'ATLASSIAN_API_TOKEN',
    );
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  async getIssueDescription(issueKey: string): Promise<AdfDoc | null> {
    const response = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}?fields=description`,
      {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
      },
    );
    if (!response.ok)
      throw new Error(
        `Jira GET ${issueKey} failed: ${response.status} ${await response.text()}`,
      );
    const data = (await response.json()) as {
      fields?: { description?: AdfDoc | null };
    };
    return data.fields?.description ?? null;
  }

  async setIssueDescription(
    issueKey: string,
    description: AdfDoc,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}`,
      {
        method: 'PUT',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ fields: { description } }),
      },
    );
    if (!response.ok)
      throw new Error(
        `Jira PUT ${issueKey} failed: ${response.status} ${await response.text()}`,
      );
  }
}
