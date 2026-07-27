import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: { url: configService.getOrThrow<string>('REDIS_URL') },
        defaultJobOptions: {
          attempts: Number(configService.get('QUEUE_JOB_ATTEMPTS') ?? 3),
          backoff: {
            type: 'exponential',
            delay: Number(configService.get('QUEUE_BACKOFF_MS') ?? 5000),
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
