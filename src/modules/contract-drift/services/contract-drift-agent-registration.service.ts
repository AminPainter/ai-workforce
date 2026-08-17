import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  CONTRACT_DRIFT_TRIAGE,
  createContractDriftTriage,
} from '../agent/contract-drift-triage.agent';
import {
  CONTRACT_DRIFT_VERIFIER,
  createContractDriftVerifier,
} from '../agent/contract-drift-verifier.agent';
import {
  CONTRACT_DRIFT_SKEPTIC,
  createContractDriftSkeptic,
} from '../agent/contract-drift-skeptic.agent';

@Injectable()
export class ContractDriftAgentRegistrationService implements OnApplicationBootstrap {
  constructor(
    private readonly aiService: AiService,
    private readonly gitHubMcpService: GitHubMcpService,
    private readonly configService: ConfigService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.agentRegistry.register(
      CONTRACT_DRIFT_TRIAGE,
      createContractDriftTriage(
        this.aiService,
        this.gitHubMcpService,
        this.configService,
      ),
    );
    this.agentRegistry.register(
      CONTRACT_DRIFT_VERIFIER,
      createContractDriftVerifier(
        this.aiService,
        this.gitHubMcpService,
        this.configService,
      ),
    );
    this.agentRegistry.register(
      CONTRACT_DRIFT_SKEPTIC,
      createContractDriftSkeptic(
        this.aiService,
        this.gitHubMcpService,
        this.configService,
      ),
    );
  }
}
