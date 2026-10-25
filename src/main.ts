import { randomUUID } from 'crypto';
import type { IncomingHttpHeaders } from 'http';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import type { RawServerDefault } from 'fastify';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './modules/app/app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      routerOptions: { ignoreTrailingSlash: true },
      genReqId: ({ headers }: { headers: IncomingHttpHeaders }) =>
        headers['x-request-id']?.toString() ?? randomUUID(),
    }),
    { rawBody: true, bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  // Express parsed an empty JSON body as {}; Fastify rejects it with a 400,
  // which would fail Zoho's unsigned webhook validation request.
  const parseJson = app
    .getHttpAdapter()
    .getInstance()
    .getDefaultJsonParser('error', 'error');
  app.useBodyParser<RawServerDefault>(
    'application/json',
    undefined,
    (req, body, done) => {
      if (body.length === 0) return done(null, {});
      void parseJson(req, body.toString(), done);
    },
  );
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  const config = app.get(ConfigService);
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<string>('PORT'), '0.0.0.0');
}
await bootstrap();
