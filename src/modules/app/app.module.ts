import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { AiModule } from '../ai/ai.module';
import { AgentsModule } from '../agents/agents.module';
import { SlackModule } from '../slack/slack.module';
import { GitHubModule } from '../github/github.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    AiModule,
    AgentsModule,
    SlackModule,
    GitHubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
