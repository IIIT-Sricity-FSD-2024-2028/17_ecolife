import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 keeps the connection URL here instead of in schema.prisma.
// Migrations should run as the database owner; the running API uses the restricted role.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL || '' }
});
