import { ToolLoopAgent, stepCountIs } from 'ai';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/services/ai.service';
import { GlomopayMcpService } from '../../ai/services/glomopay-mcp.service';
import { RegisteredAgent } from '../../agents/services/agent-registry.service';
import { GLOMOPAY_AGENT_SYSTEM_PROMPT } from './glomopay-agent.prompt';

export const GLOMOPAY_AGENT = 'glomopay-agent';

export function createGlomopayAgent(
  aiService: AiService,
  glomopayMcpService: GlomopayMcpService,
  configService: ConfigService,
): RegisteredAgent {
  return new ToolLoopAgent({
    model: aiService.model(),
    instructions: GLOMOPAY_AGENT_SYSTEM_PROMPT,
    tools: {
      ...glomopayMcpService.getTools(),
    },
    stopWhen: stepCountIs(
      Number(configService.get('GLOMOPAY_AGENT_MAX_STEPS') ?? 15),
    ),
  });
}
