import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { CodingAgentWorkerModule } from './modules/coding-agent/coding-agent-worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    CodingAgentWorkerModule,
    { bufferLogs: true },
  );
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();
  app.enableShutdownHooks();
  logger.log('coding agent worker started', 'Worker');
}
await bootstrap();
