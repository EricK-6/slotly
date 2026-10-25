const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb, createUser, createResource } = require('./helpers');

let userId;
let resourceId;

beforeEach(async () => {
  await resetDb();
  userId = await createUser();
  resourceId = await createResource('Basys 3 FPGA', 180);
});
afterAll(() => pool.end());

const book = (overrides = {}) =>
  request(app)
    .post('/bookings')
    .send({
      resource_id: resourceId,
      user_id: userId,
      starts_at: '2030-01-15T09:00:00Z',
      ends_at: '2030-01-15T10:00:00Z',
      ...overrides,
    });

describe('POST /bookings', () => {
  test('creates a booking', async () => {
    const res = await book();
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/bookings/${res.body.id}`);
    expect(res.body).toMatchObject({
      resource_id: resourceId,
      user_id: userId,
      starts_at: '2030-01-15T09:00:00.000Z',
      ends_at: '2030-01-15T10:00:00.000Z',
    });
  });

  test('returns 409 when the slot overlaps an existing booking', async () => {
    await book().expect(201);
    const res = await book({ starts_at: '2030-01-15T09:30:00Z', ends_at: '2030-01-15T10:30:00Z' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('booking_conflict');
  });

  test('treats timezone offsets correctly when detecting overlap', async () => {
    await book().expect(201);
    // 10:30+01:00 is 09:30Z, inside the existing 09:00-10:00Z booking.
    const res = await book({ starts_at: '2030-01-15T10:30:00+01:00', ends_at: '2030-01-15T11:30:00+01:00' });
    expect(res.status).toBe(409);
  });

  test('allows back-to-back bookings (ranges are half-open)', async () => {
    await book().expect(201);
    await book({ starts_at: '2030-01-15T10:00:00Z', ends_at: '2030-01-15T11:00:00Z' }).expect(201);
  });

  test('allows the same time slot on a different resource', async () => {
    const other = await createResource('Basys 3 FPGA #2');
    await book().expect(201);
    await book({ resource_id: other }).expect(201);
  });

  test('rejects bookings longer than the resource allows', async () => {
    const res = await book({ ends_at: '2030-01-15T13:00:01Z' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('booking_too_long');
  });

  test('rejects end before start', async () => {
    const res = await book({ starts_at: '2030-01-15T10:00:00Z', ends_at: '2030-01-15T09:00:00Z' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/ends_at must be after starts_at/);
  });

  test('rejects timestamps without a timezone', async () => {
    const res = await book({ starts_at: '2030-01-15 09:00' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/starts_at must be an ISO 8601 timestamp/);
  });

  test('rejects missing and mistyped fields', async () => {
    const res = await request(app).post('/bookings').send({ resource_id: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/resource_id must be a positive integer/);
    expect(res.body.error.message).toMatch(/user_id is required/);
  });

  test('returns 404 for an unknown resource or user', async () => {
    expect((await book({ resource_id: 9999 })).body.error.code).toBe('resource_not_found');
    expect((await book({ user_id: 9999 })).body.error.code).toBe('user_not_found');
  });
});

describe('GET /bookings', () => {
  test('lists active bookings for a resource, soonest first', async () => {
    const other = await createResource('Raspberry Pi 5');
    await book({ starts_at: '2030-01-15T12:00:00Z', ends_at: '2030-01-15T13:00:00Z' }).expect(201);
    await book().expect(201);
    await book({ resource_id: other }).expect(201);

    const res = await request(app).get(`/bookings?resource_id=${resourceId}`);
    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.starts_at)).toEqual(['2030-01-15T09:00:00.000Z', '2030-01-15T12:00:00.000Z']);
  });

  test('rejects a non-numeric resource_id', async () => {
    const res = await request(app).get('/bookings?resource_id=abc');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /bookings/:id', () => {
  test('cancels a booking and frees the slot', async () => {
    const { body: booking } = await book().expect(201);

    await request(app).delete(`/bookings/${booking.id}`).expect(204);
    const list = await request(app).get(`/bookings?resource_id=${resourceId}`);
    expect(list.body).toEqual([]);

    // The same slot can now be booked again.
    await book().expect(201);
  });

  test('returns 404 for unknown or already-cancelled bookings', async () => {
    const { body: booking } = await book().expect(201);
    await request(app).delete(`/bookings/${booking.id}`).expect(204);
    await request(app).delete(`/bookings/${booking.id}`).expect(404);
    await request(app).delete('/bookings/9999').expect(404);
  });
});
