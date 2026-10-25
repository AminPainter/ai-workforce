import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('LOG_LEVEL') ?? 'info',
          transport:
            configService.get<string>('NODE_ENV') === 'production'
              ? undefined
              : { target: 'pino-pretty' },
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-zdesk-jwt"]',
            'req.headers["x-hub-signature-256"]',
            'req.headers["x-slack-signature"]',
          ],
          // Render's health check hits GET / every few seconds.
          autoLogging: {
            ignore: (req) => req.method === 'GET' && req.url === '/',
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
