// Tests run against a separate database so they never wipe your dev data.
// Default matches the postgres service in docker-compose.yml.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://slotly:slotly@localhost:5432/slotly_test';

process.env.DATABASE_URL = TEST_DATABASE_URL;

module.exports = { TEST_DATABASE_URL };
