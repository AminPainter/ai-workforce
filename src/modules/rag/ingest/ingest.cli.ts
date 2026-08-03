import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app/app.module';
import { RagIngestService } from './rag-ingest.service';

interface IngestArgs {
  collection: string;
  dir: string;
}

function parseArgs(argv: string[]): IngestArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--collection' || arg === '--dir')
      args[arg.slice(2)] = argv[++i];
  }
  if (!args.collection || !args.dir)
    throw new Error(
      'usage: pnpm ingest -- --collection <name> --dir <path-to-pdf-dir>',
    );

  return { collection: args.collection, dir: args.dir };
}

async function main(): Promise<void> {
  const { collection, dir } = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const ragIngestService = app.get(RagIngestService);
    await ragIngestService.ingestDirectory(collection, dir);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  new Logger('IngestCli').error(error);
  process.exit(1);
});
