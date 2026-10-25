import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SlackModule } from '../slack/slack.module.js';
import { CodingTaskService } from './services/coding-task.service.js';
import { CodingTaskSlackSummaryProcessor } from './processors/coding-task-slack-summary.processor.js';
import { CODING_AGENT_QUEUE } from './queues/coding-agent.queue.js';

@Module({
  imports: [
    SlackModule,
    BullModule.registerQueue({ name: CODING_AGENT_QUEUE }),
  ],
  providers: [CodingTaskService, CodingTaskSlackSummaryProcessor],
  exports: [CodingTaskService],
})
export class CodingAgentModule {}
