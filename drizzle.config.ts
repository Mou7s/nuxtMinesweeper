import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema/index.ts',
  dialect: 'sqlite',
  out: './server/db/migrations/sqlite',
});
