import { tool } from 'ai';
import { z } from 'zod';
import { RagRetrievalService } from '../services/rag-retrieval.service';

export function createKnowledgeSearchTool(
  ragRetrievalService: RagRetrievalService,
  collection: string,
  description: string,
) {
  return tool({
    description,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'A focused natural-language question or set of keywords to look up in the knowledge base.',
        ),
    }),
    execute: ({ query }) => ragRetrievalService.search(collection, query),
  });
}
