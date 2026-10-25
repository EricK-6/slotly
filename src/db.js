const { Pool, types } = require('pg');

// Return BIGINT ids as JS numbers instead of strings (safe below 2^53).
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));

// Uses DATABASE_URL when set, otherwise the standard PG* variables
// (PGHOST, PGUSER, PGPASSWORD, PGSSLMODE, ...), which is how the AWS deploy connects.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Runs fn(client) inside BEGIN/COMMIT on one connection; rolls back on any error.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
