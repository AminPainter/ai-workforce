import { z } from 'zod';

const chatwootMessageSchema = z.object({
  content: z.string().nullish(),
  message_type: z.union([z.string(), z.number()]).optional(),
  private: z.boolean().optional().default(false),
});

export const chatwootWebhookPayloadSchema = z.object({
  event: z.string(),
  content: z.string().nullish(),
  message_type: z.union([z.string(), z.number()]).optional(),
  private: z.boolean().optional().default(false),
  conversation: z.object({
    id: z.number(),
    status: z.string().optional(),
    messages: z.array(chatwootMessageSchema).optional().default([]),
  }),
});

export type ChatwootWebhookPayload = z.infer<
  typeof chatwootWebhookPayloadSchema
>;
export type ChatwootMessage = z.infer<typeof chatwootMessageSchema>;
