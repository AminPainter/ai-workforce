import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SlackModule } from '../slack/slack.module';
import { GitHubModule } from '../github/github.module';
import { ContractDriftModule } from '../contract-drift/contract-drift.module';
import { ChatwootModule } from '../chatwoot/chatwoot.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    QueueModule,
    AiModule,
    AgentsModule,
    SlackModule,
    GitHubModule,
    ContractDriftModule,
    ChatwootModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
