export const ZOHO_TICKET_THREAD_ADDED = 'zoho.ticket.thread.added';

export interface ZohoTicketThreadAddedEvent {
  ticketId: string;
  threadId: string;
  orgId: string;
}
