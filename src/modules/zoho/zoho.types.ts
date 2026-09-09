export interface ZohoTicketThreadAddedEvent {
  ticketId: string;
  threadId: string;
  orgId: string;
}

export interface ZohoTicketResponse {
  id?: string;
  subject?: string;
}

export interface ZohoThreadResponse {
  type?: string;
  direction?: string;
  content?: string;
  summary?: string;
  author?: { name?: string };
  createdTime?: string;
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
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

export interface ZohoWebhookEvent {
  eventType?: string;
  orgId?: string;
  payload?: {
    id?: string;
    threadId?: string;
    ticketId?: string;
    direction?: string;
  };
}
