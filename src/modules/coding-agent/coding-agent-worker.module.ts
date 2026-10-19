import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from '../queue/queue.module';
import { CODING_AGENT, createCodingAgent } from './agent/coding.agent';
import { CodingSessionRepository } from './services/coding-session.repository';
import { CodingTaskProcessor } from './processors/coding-task.processor';
import { CODING_TASK_SLACK_SUMMARY_QUEUE } from './queues/coding-agent.queue';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    BullModule.registerQueue({ name: CODING_TASK_SLACK_SUMMARY_QUEUE }),
  ],
  providers: [
    {
      provide: CODING_AGENT,
      useFactory: createCodingAgent,
      inject: [ConfigService],
    },
    CodingSessionRepository,
    CodingTaskProcessor,
  ],
})
export class CodingAgentWorkerModule {}
