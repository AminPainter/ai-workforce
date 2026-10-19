import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from '../queue/queue.module';
import { CODING_AGENT, createCodingAgent } from './agent/coding.agent';
import { CodingSessionRepository } from './services/coding-session.repository';
import { CodingTaskProcessor } from './processors/coding-task.processor';
import { CODING_TASK_SLACK_SUMMARY_QUEUE } from './queues/coding-agent.queue';
import { KongRouteSyncCodingProcessor } from '../kong-route-sync/processors/kong-route-sync-coding.processor';
import { KONG_ROUTE_SYNC_NOTIFICATION_QUEUE } from '../kong-route-sync/queues/kong-route-sync.queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    BullModule.registerQueue(
      { name: CODING_TASK_SLACK_SUMMARY_QUEUE },
      { name: KONG_ROUTE_SYNC_NOTIFICATION_QUEUE },
    ),
  ],
  providers: [
    {
      provide: CODING_AGENT,
      useFactory: createCodingAgent,
      inject: [ConfigService],
    },
    CodingSessionRepository,
    CodingTaskProcessor,
    KongRouteSyncCodingProcessor,
  ],
})
export class CodingAgentWorkerModule {}
