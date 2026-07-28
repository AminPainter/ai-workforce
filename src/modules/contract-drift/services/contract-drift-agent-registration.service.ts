import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GitHubMcpService } from '../../ai/services/github-mcp.service';
import { AgentRegistry } from '../../agents/services/agent-registry.service';
import {
  CONTRACT_DRIFT_DETECTOR,
  createContractDriftDetector,
} from '../agent/contract-drift-detector.agent';

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
      CONTRACT_DRIFT_DETECTOR,
      createContractDriftDetector(
        this.aiService,
        this.gitHubMcpService,
        this.configService,
      ),
    );
  }
}
