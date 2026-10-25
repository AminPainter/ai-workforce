import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './controllers/app.controller.js';
import { AppService } from './services/app.service.js';
import { AiModule } from '../ai/ai.module.js';
import { AgentsModule } from '../agents/agents.module.js';
import { SlackModule } from '../slack/slack.module.js';
import { GitHubModule } from '../github/github.module.js';
import { KongRouteSyncModule } from '../kong-route-sync/kong-route-sync.module.js';
import { EmployeeAssistantModule } from '../employee-assistant/employee-assistant.module.js';
import { SnackTrackerModule } from '../snack-tracker/snack-tracker.module.js';
import { LeaveTrackerModule } from '../leave-tracker/leave-tracker.module.js';
import { ZohoModule } from '../zoho/zoho.module.js';
import { CustomerSupportModule } from '../customer-support/customer-support.module.js';
import { Form9Module } from '../form9/form9.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { HealthModule } from '../health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    HealthModule,
    EventEmitterModule.forRoot(),
    QueueModule,
    PrismaModule,
    AiModule,
    AgentsModule,
    SlackModule,
    GitHubModule,
    KongRouteSyncModule,
    EmployeeAssistantModule,
    SnackTrackerModule,
    LeaveTrackerModule,
    ZohoModule,
    CustomerSupportModule,
    Form9Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
