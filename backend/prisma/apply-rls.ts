import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const databaseUrl = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('MIGRATE_DATABASE_URL (or DATABASE_URL) is required to apply RLS & constraints.');
  }
  const sqlPath = path.resolve(__dirname, 'rls-and-constraints.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // The API must connect as this ordinary role; row-level security does not apply to superusers.
    const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'tropos_app'");
    if (role.rowCount === 0) {
      const pw = process.env.APP_DB_PASSWORD;
      if (!pw || pw.length < 8) throw new Error('Set APP_DB_PASSWORD (at least 8 characters) in .env so the restricted role "tropos_app" can be created.');
      await client.query(`CREATE ROLE tropos_app LOGIN PASSWORD '${pw.replace(/'/g, "''")}' NOSUPERUSER NOBYPASSRLS`);
      console.log('Created database role tropos_app.');
    }
    await client.query(sql);
    console.log('Applied Tropos RLS policies, CHECK constraints, and 8 compliance triggers successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply rls-and-constraints.sql:', err);
  process.exit(1);
});
