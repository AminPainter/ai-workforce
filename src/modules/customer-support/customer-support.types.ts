import { z } from 'zod';
import { customerSupportDraftSchema } from './agent/customer-support.schema';

export interface CustomerSupportJob {
  ticketId: string;
  threadId: string;
  orgId: string;
}

export type CustomerSupportDraft = z.infer<typeof customerSupportDraftSchema>;
