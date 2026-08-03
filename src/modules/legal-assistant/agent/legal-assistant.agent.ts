import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { RagRetrievalService } from '../../rag/services/rag-retrieval.service';
import { createKnowledgeSearchTool } from '../../rag/tools/knowledge-search.tool';
import { RagCollection } from '../../rag/constants';
import { LEGAL_ASSISTANT_SYSTEM_PROMPT } from './legal-assistant.prompt';

export const LEGAL_ASSISTANT = 'legal-assistant';

const LEGAL_KNOWLEDGE_SEARCH_DESCRIPTION =
  "Search GlomoPay's internal legal reference documents and return the most relevant excerpts, each tagged with its source file and page. Call this for ANY question about the legal documents, before answering — it is your only source of truth. Refine the query and call again when results are thin.";

export function createLegalAssistant(
  aiService: AiService,
  ragRetrievalService: RagRetrievalService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: LEGAL_ASSISTANT_SYSTEM_PROMPT,
    tools: {
      legalKnowledgeSearch: createKnowledgeSearchTool(
        ragRetrievalService,
        RagCollection.LEGAL,
        LEGAL_KNOWLEDGE_SEARCH_DESCRIPTION,
      ),
    },
    stopWhen: stepCountIs(
      Number(configService.get('LEGAL_ASSISTANT_MAX_STEPS') ?? 20),
    ),
  });
}
