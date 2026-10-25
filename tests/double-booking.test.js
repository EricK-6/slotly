// The core guarantee: two overlapping bookings for one resource can never both succeed,
// no matter how the requests interleave.
const request = require('supertest');
const { Client } = require('pg');
const app = require('../src/app');
const { pool, resetDb, createUser, createResource } = require('./helpers');

let resourceId;
let userIds;

beforeEach(async () => {
  await resetDb();
  resourceId = await createResource();
  userIds = await Promise.all(Array.from({ length: 20 }, (_, i) => createUser(`Student ${i}`)));
});
afterAll(() => pool.end());

test('20 concurrent requests for overlapping slots: exactly one wins, the rest get 409', async () => {
  const ROUNDS = 10; // races are probabilistic, so run the stampede several times

  for (let day = 1; day <= ROUNDS; day++) {
    // Each student asks for a slightly different window, all covering 09:50-10:30.
    const responses = await Promise.all(
      userIds.map((userId, i) =>
        request(app)
          .post('/bookings')
          .send({
            resource_id: resourceId,
            user_id: userId,
            starts_at: new Date(Date.UTC(2030, 0, day, 9, 31 + i)).toISOString(),
            ends_at: new Date(Date.UTC(2030, 0, day, 10, 30 + i)).toISOString(),
          }),
      ),
    );

    // Every loser must get a clean 409: no 500s from deadlocks or anything else.
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, ...Array(19).fill(409)]);
  }

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM bookings WHERE resource_id = $1', [resourceId]);
  expect(rows[0].n).toBe(ROUNDS);
});

test('the database blocks the race even when an app-level "is it free?" check passes', async () => {
  // Two separate connections, simulating two API servers handling requests at once.
  const a = new Client({ connectionString: process.env.DATABASE_URL });
  const b = new Client({ connectionString: process.env.DATABASE_URL });
  await Promise.all([a.connect(), b.connect()]);

  const slot = ['2030-01-15T09:00:00Z', '2030-01-15T10:00:00Z'];
  const insert = 'INSERT INTO bookings (resource_id, user_id, starts_at, ends_at) VALUES ($1, $2, $3, $4)';
  const naiveCheck = `SELECT count(*)::int AS n FROM bookings
                      WHERE resource_id = $1 AND cancelled_at IS NULL
                        AND tstzrange(starts_at, ends_at) && tstzrange($2, $3)`;

  try {
    await a.query('BEGIN');
    await b.query('BEGIN');

    // Both transactions check first, and both see the slot as free.
    expect((await a.query(naiveCheck, [resourceId, ...slot])).rows[0].n).toBe(0);
    expect((await b.query(naiveCheck, [resourceId, ...slot])).rows[0].n).toBe(0);

    await a.query(insert, [resourceId, userIds[0], ...slot]);
    const bInsert = b.query(insert, [resourceId, userIds[1], ...slot]).then(
      () => 'inserted',
      (err) => err,
    );

    // Wait until B is genuinely blocked on A's uncommitted row, then let A commit.
    await waitForLockWait(b.processID);
    await a.query('COMMIT');

    const outcome = await bInsert;
    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.code).toBe('23P01'); // exclusion_violation
    expect(outcome.constraint).toBe('bookings_no_overlap');
    await b.query('ROLLBACK');
  } finally {
    await Promise.all([a.end(), b.end()]);
  }

  const { rows } = await pool.query('SELECT user_id FROM bookings');
  expect(rows).toEqual([{ user_id: userIds[0] }]);
});

async function waitForLockWait(pid) {
  for (let i = 0; i < 100; i++) {
    const { rows } = await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1', [pid]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`backend ${pid} never blocked on a lock`);
}
