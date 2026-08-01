import type { ChatwootWebhookPayload } from './chatwoot.schema';

export const CHATWOOT_MESSAGE_CREATED_EVENT = 'chatwoot.message_created';

export interface ChatwootMessageCreatedEvent {
  deliveryId: string;
  conversationId: number;
  accountId?: number;
  inboxId?: number;
  status?: string;
  payload: ChatwootWebhookPayload;
}
