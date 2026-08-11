import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Prisma's raw executor runs one statement per call (extended protocol), so
// split each migration file into its individual statements. The migration SQL
// is trusted, single-line-comment-free DDL — a plain `;` split is sufficient.
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function main(): Promise<void> {
  requireEnv('DATABASE_URL');
  const dimensions = requireEnv('RAG_EMBEDDING_DIMENSIONS');
  if (!/^\d+$/.test(dimensions))
    throw new Error(
      `RAG_EMBEDDING_DIMENSIONS must be a positive integer, got "${dimensions}"`,
    );

  const prisma = new PrismaClient();
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replaceAll(
        '${RAG_EMBEDDING_DIMENSIONS}',
        dimensions,
      );
      console.log(`applying ${file}`);
      for (const statement of splitStatements(sql))
        await prisma.$executeRawUnsafe(statement);
    }
    console.log(`migrations complete (${files.length} applied)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
