import type { ChatwootMessageCreatedEvent } from '../chatwoot.events';

export const CHATWOOT_QUEUE = 'chatwoot';

export type ChatwootDraftJob = ChatwootMessageCreatedEvent;
