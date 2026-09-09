import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type {
  CachedToken,
  ZohoCommentInput,
  ZohoConversationEntry,
  ZohoTicket,
} from '../zoho.types';

const ACCOUNTS_URL = 'https://accounts.zoho.in';
const DESK_BASE_URL = 'https://desk.zoho.in';
const TOKEN_EXPIRY_SKEW_MS = 60_000;

interface ZohoTicketResponse {
  id?: string;
  subject?: string;
}

interface ZohoThreadResponse {
  type?: string;
  direction?: string;
  content?: string;
  summary?: string;
  author?: { name?: string };
}

@Injectable()
export class ZohoDeskService {
  private readonly logger = new Logger(ZohoDeskService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly orgId: string;
  private readonly deskClient: AxiosInstance;
  private cachedToken?: CachedToken;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('ZOHO_CLIENT_ID');
    this.clientSecret =
      this.configService.getOrThrow<string>('ZOHO_CLIENT_SECRET');
    this.refreshToken =
      this.configService.getOrThrow<string>('ZOHO_REFRESH_TOKEN');
    this.orgId = this.configService.getOrThrow<string>('ZOHO_ORG_ID');

    this.deskClient = axios.create({
      baseURL: `${DESK_BASE_URL}/api/v1`,
      headers: { orgId: this.orgId },
    });

    this.deskClient.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers.set(
        'Authorization',
        `Zoho-oauthtoken ${token.accessToken}`,
      );
      return config;
    });

    this.deskClient.interceptors.response.use(
      (response) => {
        const { method, url } = response.config;
        this.logger.log(
          `Zoho Desk ${method?.toUpperCase()} ${url} raw response: ${JSON.stringify(response.data)}`,
        );
        return response;
      },
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response) {
          const { method, url } = error.config ?? {};
          this.logger.error(
            `Zoho Desk ${method?.toUpperCase()} ${url} failed: ${error.response.status} ${JSON.stringify(error.response.data)}`,
          );
        }
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    );
  }

  async getTicket(ticketId: string): Promise<ZohoTicket> {
    const { data: ticket } = await this.deskClient.get<ZohoTicketResponse>(
      `/tickets/${ticketId}`,
    );
    return {
      id: ticket.id ?? ticketId,
      subject: ticket.subject ?? '',
    };
  }

  async getConversations(ticketId: string): Promise<ZohoConversationEntry[]> {
    const { data: response } = await this.deskClient.get<{
      data?: ZohoThreadResponse[];
    }>(`/tickets/${ticketId}/conversations`);
    const entries = response.data ?? [];
    return entries.map((entry) => ({
      type: entry.type ?? 'thread',
      direction: entry.direction,
      author: entry.author?.name,
      content: entry.content ?? entry.summary ?? '',
    }));
  }

  async addPrivateComment(
    ticketId: string,
    input: ZohoCommentInput,
  ): Promise<void> {
    await this.deskClient.post(`/tickets/${ticketId}/comments`, {
      content: input.content,
      contentType: 'plainText',
      isPublic: false,
    });
    this.logger.log(`added private comment on ticket ${ticketId}`);
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

    const { data: token } = await axios.post<{
      access_token?: string;
      expires_in?: number;
    }>(`${ACCOUNTS_URL}/oauth/v2/token?${params.toString()}`);
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
