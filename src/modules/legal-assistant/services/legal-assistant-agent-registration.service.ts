import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { RagRetrievalService } from '../../rag/services/rag-retrieval.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  LEGAL_ASSISTANT,
  createLegalAssistant,
} from '../agent/legal-assistant.agent';

@Injectable()
export class LegalAssistantAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly ragRetrievalService: RagRetrievalService,
    private readonly configService: ConfigService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      LEGAL_ASSISTANT,
      createLegalAssistant(
        this.aiService,
        this.ragRetrievalService,
        this.configService,
      ),
    );
  }
}
