import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ACCOUNTS_URL = 'https://accounts.zoho.in';
const DESK_BASE_URL = 'https://desk.zoho.in';
const TOKEN_EXPIRY_SKEW_MS = 60_000;

function optString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export interface ZohoTicket {
  id: string;
  subject: string;
}

export interface ZohoConversationEntry {
  type: string;
  direction?: string;
  author?: string;
  content: string;
}

export interface ZohoCommentInput {
  content: string;
  contentType: 'html' | 'plainText';
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class ZohoDeskService {
  private readonly logger = new Logger(ZohoDeskService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly orgId: string;
  private cachedToken?: CachedToken;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('ZOHO_CLIENT_ID');
    this.clientSecret =
      this.configService.getOrThrow<string>('ZOHO_CLIENT_SECRET');
    this.refreshToken =
      this.configService.getOrThrow<string>('ZOHO_REFRESH_TOKEN');
    this.orgId = this.configService.getOrThrow<string>('ZOHO_ORG_ID');
  }

  async getTicket(ticketId: string): Promise<ZohoTicket> {
    const ticket = await this.request<Record<string, unknown>>(
      'GET',
      `/tickets/${ticketId}`,
    );
    return {
      id: optString(ticket.id) ?? ticketId,
      subject: optString(ticket.subject) ?? '',
    };
  }

  async getConversations(ticketId: string): Promise<ZohoConversationEntry[]> {
    const response = await this.request<{ data?: unknown[] }>(
      'GET',
      `/tickets/${ticketId}/conversations`,
    );
    const entries = Array.isArray(response.data) ? response.data : [];
    return entries.map((raw) => {
      const entry = raw as Record<string, unknown>;
      const author = entry.author as Record<string, unknown> | undefined;
      return {
        type: optString(entry.type) ?? 'thread',
        direction: optString(entry.direction),
        author: optString(author?.name),
        content: optString(entry.content) ?? optString(entry.summary) ?? '',
      };
    });
  }

  async addPrivateComment(
    ticketId: string,
    input: ZohoCommentInput,
  ): Promise<void> {
    await this.request('POST', `/tickets/${ticketId}/comments`, {
      content: input.content,
      contentType: input.contentType,
      isPublic: false,
    });
    this.logger.log(`added private comment on ticket ${ticketId}`);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${DESK_BASE_URL}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token.accessToken}`,
        orgId: this.orgId,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Zoho Desk ${method} ${path} failed: ${response.status} ${detail}`,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async getAccessToken(): Promise<CachedToken> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now())
      return this.cachedToken;

    const params = new URLSearchParams({
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(
      `${ACCOUNTS_URL}/oauth/v2/token?${params.toString()}`,
      { method: 'POST' },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Zoho OAuth token refresh failed: ${response.status} ${detail}`,
      );
    }

    const token = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!token.access_token)
      throw new Error('Zoho OAuth token refresh returned no access_token');

    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt:
        Date.now() + (token.expires_in ?? 3600) * 1000 - TOKEN_EXPIRY_SKEW_MS,
    };
    return this.cachedToken;
  }
}
