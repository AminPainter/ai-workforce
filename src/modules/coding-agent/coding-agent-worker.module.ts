import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from '../queue/queue.module';
import { CODING_AGENT, createCodingAgentFactory } from './agent/coding.agent';
import { CodingSessionRepository } from './services/coding-session.repository';
import { CodingTaskProcessor } from './processors/coding-task.processor';
import { CODING_TASK_SLACK_SUMMARY_QUEUE } from './queues/coding-agent.queue';
import {
  KONG_ROUTE_SYNC_CODING_AGENT,
  createKongRouteSyncCodingAgentFactory,
} from '../kong-route-sync/agent/kong-route-sync-coding.agent';
import { KongRouteSyncCodingProcessor } from '../kong-route-sync/processors/kong-route-sync-coding.processor';
import { KONG_ROUTE_SYNC_NOTIFICATION_QUEUE } from '../kong-route-sync/queues/kong-route-sync.queue';
import { GitHubAppModule } from '../github/github-app.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    GitHubAppModule,
    BullModule.registerQueue(
      { name: CODING_TASK_SLACK_SUMMARY_QUEUE },
      { name: KONG_ROUTE_SYNC_NOTIFICATION_QUEUE },
    ),
  ],
  providers: [
    {
      provide: CODING_AGENT,
      useFactory: createCodingAgentFactory,
      inject: [ConfigService],
    },
    {
      provide: KONG_ROUTE_SYNC_CODING_AGENT,
      useFactory: createKongRouteSyncCodingAgentFactory,
      inject: [ConfigService],
    },
    CodingSessionRepository,
    CodingTaskProcessor,
    KongRouteSyncCodingProcessor,
  ],
})
export class CodingAgentWorkerModule {}
