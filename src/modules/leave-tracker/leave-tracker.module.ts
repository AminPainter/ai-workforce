import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { SlackModule } from '../slack/slack.module.js';
import { RazorpayxModule } from '../razorpayx/razorpayx.module.js';
import { LeaveTrackerAgentRegistrationService } from './services/leave-tracker-agent-registration.service.js';
import { LeaveMessageContextService } from './services/leave-message-context.service.js';
import { LeaveAttendanceService } from './services/leave-attendance.service.js';
import { LeaveTrackerListener } from './leave-tracker.listener.js';
import { LeaveTrackerProcessor } from './processors/leave-tracker.processor.js';
import { LEAVE_TRACKER_QUEUE } from './queues/leave-tracker.queue.js';

@Module({
  imports: [
    AiModule,
    AgentsModule,
    SlackModule,
    RazorpayxModule,
    BullModule.registerQueue({ name: LEAVE_TRACKER_QUEUE }),
  ],
  providers: [
    LeaveTrackerAgentRegistrationService,
    LeaveMessageContextService,
    LeaveAttendanceService,
    LeaveTrackerListener,
    LeaveTrackerProcessor,
  ],
})
export class LeaveTrackerModule {}
