import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatwootConversation {
  id: number;
  status: string;
}

export interface ChatwootApiMessage {
  content?: string | null;
  message_type: string | number;
  private?: boolean;
}

@Injectable()
export class ChatwootApiClient {
  private readonly baseUrl: string;
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    const base = this.configService
      .getOrThrow<string>('CHATWOOT_BASE_URL')
      .replace(/\/$/, '');
    const accountId = this.configService.getOrThrow<string>(
      'CHATWOOT_ACCOUNT_ID',
    );
    this.baseUrl = `${base}/api/v1/accounts/${accountId}`;
    this.botToken = this.configService.getOrThrow<string>('CHATWOOT_BOT_TOKEN');
  }

  async getConversation(conversationId: number): Promise<ChatwootConversation> {
    return this.request<ChatwootConversation>(
      `/conversations/${conversationId}`,
      'GET',
    );
  }

  async getConversationMessages(
    conversationId: number,
  ): Promise<ChatwootApiMessage[]> {
    const response = await this.request<{ payload?: ChatwootApiMessage[] }>(
      `/conversations/${conversationId}/messages`,
      'GET',
    );
    return response.payload ?? [];
  }

  async sendPrivateNote(
    conversationId: number,
    content: string,
  ): Promise<void> {
    await this.request(`/conversations/${conversationId}/messages`, 'POST', {
      content,
      private: true,
    });
  }

  async handoffToHuman(conversationId: number): Promise<void> {
    await this.request(
      `/conversations/${conversationId}/toggle_status`,
      'POST',
      { status: 'open' },
    );
  }

  private async request<T = unknown>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        api_access_token: this.botToken,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Chatwoot API ${method} ${path} failed: ${response.status} ${detail.slice(0, 200)}`,
      );
    }
    return (await response.json().catch(() => ({}))) as T;
  }
}
