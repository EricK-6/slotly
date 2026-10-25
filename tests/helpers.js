const { pool } = require('../src/db');

async function resetDb() {
  await pool.query('TRUNCATE bookings, resources, users RESTART IDENTITY CASCADE');
}

async function createUser(name = 'Test User', email = `user${Math.random()}@uni.example`) {
  const { rows } = await pool.query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id', [name, email]);
  return rows[0].id;
}

async function createResource(name = 'Basys 3 FPGA', maxMinutes = 240) {
  const { rows } = await pool.query(
    `INSERT INTO resources (name, category, max_booking_minutes) VALUES ($1, 'fpga', $2) RETURNING id`,
    [name, maxMinutes],
  );
  return rows[0].id;
}

module.exports = { pool, resetDb, createUser, createResource };
