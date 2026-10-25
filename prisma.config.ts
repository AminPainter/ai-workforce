import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not env(): it throws when unset, and `prisma generate` runs in the
    // Docker build stage where DATABASE_URL is absent.
    url: process.env.DATABASE_URL,
  },
});
