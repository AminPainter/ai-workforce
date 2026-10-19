import { NestFactory } from '@nestjs/core';
import { CodingAgentWorkerModule } from './modules/coding-agent/coding-agent-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    CodingAgentWorkerModule,
  );
  app.enableShutdownHooks();
}
bootstrap();
