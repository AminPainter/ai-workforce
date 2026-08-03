import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const dimensions = requireEnv('RAG_EMBEDDING_DIMENSIONS');
  if (!/^\d+$/.test(dimensions))
    throw new Error(
      `RAG_EMBEDDING_DIMENSIONS must be a positive integer, got "${dimensions}"`,
    );

  const pool = new Pool({ connectionString });
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
      await pool.query(sql);
    }
    console.log(`migrations complete (${files.length} applied)`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
