const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Session-level advisory lock key (D-14). The image CMD and a manual run can overlap; the lock
// serialises them, and the second runner then finds every file already applied. Session level,
// not transaction level, because each file runs in its own transaction.
const MIGRATION_LOCK_KEY = 7017015;

async function runMigrations(config) {
  const client = new Client(
    config || {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'ibp',
      password: process.env.POSTGRES_PASSWORD || 'ibp',
      database: process.env.POSTGRES_DB || 'ibp'
    }
  );

  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.resolve(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (exists.rowCount) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${file}`);
    }

    console.log('Migrations are up to date.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

module.exports = { runMigrations, MIGRATION_LOCK_KEY };

if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  });
}
