// Tiny migration runner: applies db/migrations/*.sql in filename order, once.
// Usage: node db/migrate.js [--seed]
const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEED_FILE = path.join(__dirname, 'seed.sql');
const LOCK_ID = 7135; // arbitrary key so concurrent runners wait for each other

async function migrate({ connectionString = process.env.DATABASE_URL, seed = false, log = console.log } = {}) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      // Each migration and its bookkeeping row commit together or not at all.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${file} failed: ${err.message}`);
      }
    }

    if (seed) {
      await client.query(await fs.readFile(SEED_FILE, 'utf8'));
      log('seeded demo data');
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

if (require.main === module) {
  migrate({ seed: process.argv.includes('--seed') })
    .then(() => console.log('database is up to date'))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { migrate };
