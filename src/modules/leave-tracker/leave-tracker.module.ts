import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SlackModule } from '../slack/slack.module';
import { RazorpayxModule } from '../razorpayx/razorpayx.module';
import { LeaveTrackerAgentRegistrationService } from './services/leave-tracker-agent-registration.service';
import { LeaveLedgerService } from './services/leave-ledger.service';
import { LeaveMessageContextService } from './services/leave-message-context.service';
import { LeaveAttendanceService } from './services/leave-attendance.service';
import { LeaveTrackerListener } from './leave-tracker.listener';
import { LeaveTrackerProcessor } from './processors/leave-tracker.processor';
import { LEAVE_TRACKER_QUEUE } from './queues/leave-tracker.queue';

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
    LeaveLedgerService,
    LeaveMessageContextService,
    LeaveAttendanceService,
    LeaveTrackerListener,
    LeaveTrackerProcessor,
  ],
})
export class LeaveTrackerModule {}
