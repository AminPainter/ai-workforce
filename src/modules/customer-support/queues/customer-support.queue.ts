export const CUSTOMER_SUPPORT_QUEUE = 'customer-support';

export interface CustomerSupportJob {
  ticketId: string;
  threadId: string;
  orgId: string;
}
