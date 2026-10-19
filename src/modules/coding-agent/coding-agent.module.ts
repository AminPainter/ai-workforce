import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SlackModule } from '../slack/slack.module';
import { CodingTaskService } from './services/coding-task.service';
import { CodingReplyProcessor } from './processors/coding-reply.processor';
import { CODING_AGENT_QUEUE } from './queues/coding-agent.queue';

@Module({
  imports: [
    SlackModule,
    BullModule.registerQueue({ name: CODING_AGENT_QUEUE }),
  ],
  providers: [CodingTaskService, CodingReplyProcessor],
  exports: [CodingTaskService],
})
export class CodingAgentModule {}
