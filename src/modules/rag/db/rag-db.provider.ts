import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';
import pgvector from 'pgvector/pg';
import { RAG_DB } from '../constants';

const logger = new Logger('RagDb');

export const ragDbProvider: Provider = {
  provide: RAG_DB,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Pool => {
    const pool = new Pool({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
    });
    pool.on('connect', (client: PoolClient) => {
      pgvector
        .registerType(client)
        .catch((error: unknown) =>
          logger.warn(`failed to register pgvector type: ${String(error)}`),
        );
    });
    pool.on('error', (error) =>
      logger.error(`idle pg client error: ${error.message}`),
    );
    return pool;
  },
};
