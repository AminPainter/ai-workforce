import { repl } from '@nestjs/core';
import { AppModule } from './modules/app/app.module.js';

async function bootstrap() {
  await repl(AppModule);
}
await bootstrap();
