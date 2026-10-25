// Runs once before all tests: create the test database if needed, then migrate it.
const { Client } = require('pg');
const { TEST_DATABASE_URL } = require('./env');
const { migrate } = require('../db/migrate');

module.exports = async function globalSetup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  await migrate({ connectionString: TEST_DATABASE_URL, log: () => {} });
};
