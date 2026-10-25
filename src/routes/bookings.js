const express = require('express');
const { pool, withTransaction } = require('../db');
const { HttpError } = require('../errors');
const { rules, validateBody, parseId } = require('../validate');

const router = express.Router();
const COLUMNS = 'id, resource_id, user_id, starts_at, ends_at, created_at';

// GET /bookings?resource_id=1  (active bookings, soonest first)
router.get('/', async (req, res) => {
  const params = [];
  let where = 'cancelled_at IS NULL';
  if (req.query.resource_id !== undefined) {
    params.push(parseId(req.query.resource_id, 'resource_id'));
    where += ' AND resource_id = $1';
  }
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM bookings WHERE ${where} ORDER BY starts_at`, params);
  res.json(rows);
});

// POST /bookings { resource_id, user_id, starts_at, ends_at }
router.post('/', async (req, res) => {
  const body = validateBody(req.body, {
    resource_id: [rules.id],
    user_id: [rules.id],
    starts_at: [rules.timestamp],
    ends_at: [rules.timestamp],
  });

  const minutes = (Date.parse(body.ends_at) - Date.parse(body.starts_at)) / 60_000;
  if (minutes <= 0) throw new HttpError(400, 'validation_failed', 'ends_at must be after starts_at');

  const booking = await withTransaction(async (client) => {
    // Lock the resource row so bookings for the same resource queue up one at a time.
    // Without this, concurrent exclusion checks can wait on each other and Postgres
    // aborts one with "deadlock detected" (a 500) instead of a clean 409.
    // Different resources never wait on each other.
    const { rows: [resource] } = await client.query(
      'SELECT max_booking_minutes FROM resources WHERE id = $1 FOR NO KEY UPDATE',
      [body.resource_id],
    );
    if (!resource) throw new HttpError(404, 'resource_not_found', 'Resource not found');
    if (minutes > resource.max_booking_minutes) {
      throw new HttpError(422, 'booking_too_long', `This resource can be booked for at most ${resource.max_booking_minutes} minutes`);
    }

    // No "is this slot free?" SELECT here. The bookings_no_overlap constraint is
    // the single source of truth and rejects overlaps atomically (-> 409).
    const { rows } = await client.query(
      `INSERT INTO bookings (resource_id, user_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [body.resource_id, body.user_id, body.starts_at, body.ends_at],
    );
    return rows[0];
  });

  res.status(201).location(`/bookings/${booking.id}`).json(booking);
});

// DELETE /bookings/:id  (soft cancel: keeps history and frees the slot)
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'id');
  const { rowCount } = await pool.query(
    'UPDATE bookings SET cancelled_at = now() WHERE id = $1 AND cancelled_at IS NULL',
    [id],
  );
  if (rowCount === 0) throw new HttpError(404, 'booking_not_found', 'Booking not found');
  res.status(204).end();
});

module.exports = router;
