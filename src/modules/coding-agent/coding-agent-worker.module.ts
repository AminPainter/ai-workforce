import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from '../queue/queue.module';
import { CODING_AGENT, createCodingAgent } from './agent/coding.agent';
import { CodingSessionRepository } from './services/coding-session.repository';
import { GitWorkspaceService } from './services/git-workspace.service';
import { GitHubPullRequestService } from './services/github-pull-request.service';
import { CodingTaskProcessor } from './processors/coding-task.processor';
import { CODING_AGENT_REPLIES_QUEUE } from './queues/coding-agent.queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    BullModule.registerQueue({ name: CODING_AGENT_REPLIES_QUEUE }),
  ],
  providers: [
    {
      provide: CODING_AGENT,
      useFactory: createCodingAgent,
      inject: [ConfigService],
    },
    CodingSessionRepository,
    GitWorkspaceService,
    GitHubPullRequestService,
    CodingTaskProcessor,
  ],
})
export class CodingAgentWorkerModule {}
