import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from '../queue/queue.module';
import { PI_CODING_AGENT, createPiCodingAgent } from './agent/pi-coding.agent';
import { CodingSessionRepository } from './services/coding-session.repository';
import { GitWorkspaceService } from './services/git-workspace.service';
import { GitHubPullRequestService } from './services/github-pull-request.service';
import { CodingTurnProcessor } from './processors/coding-turn.processor';
import { CODING_AGENT_REPLIES_QUEUE } from './queues/coding-agent.queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    BullModule.registerQueue({ name: CODING_AGENT_REPLIES_QUEUE }),
  ],
  providers: [
    {
      provide: PI_CODING_AGENT,
      useFactory: createPiCodingAgent,
      inject: [ConfigService],
    },
    CodingSessionRepository,
    GitWorkspaceService,
    GitHubPullRequestService,
    CodingTurnProcessor,
  ],
})
export class CodingAgentWorkerModule {}
