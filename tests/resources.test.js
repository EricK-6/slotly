const request = require('supertest');
const app = require('../src/app');
const { pool, resetDb } = require('./helpers');

beforeEach(resetDb);
afterAll(() => pool.end());

const scope = { name: 'Rigol DS1054Z', category: 'oscilloscope', location: 'EE Lab 2.10', max_booking_minutes: 120 };

describe('POST /resources', () => {
  test('creates a resource', async () => {
    const res = await request(app).post('/resources').send(scope);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, ...scope });
  });

  test('defaults max_booking_minutes to 240', async () => {
    const res = await request(app).post('/resources').send({ name: 'Raspberry Pi 5', category: 'raspberry_pi' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ location: null, max_booking_minutes: 240 });
  });

  test('rejects invalid input with every problem listed', async () => {
    const res = await request(app).post('/resources').send({ name: '', max_booking_minutes: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.message).toMatch(/name/);
    expect(res.body.error.message).toMatch(/category is required/);
    expect(res.body.error.message).toMatch(/max_booking_minutes/);
  });

  test('returns 409 for a duplicate name', async () => {
    await request(app).post('/resources').send(scope).expect(201);
    const res = await request(app).post('/resources').send(scope);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('resource_exists');
  });
});

describe('GET /resources', () => {
  test('lists resources and filters by category', async () => {
    await request(app).post('/resources').send(scope).expect(201);
    await request(app).post('/resources').send({ name: 'Basys 3', category: 'fpga' }).expect(201);

    const all = await request(app).get('/resources');
    expect(all.status).toBe(200);
    expect(all.body.map((r) => r.name)).toEqual(['Rigol DS1054Z', 'Basys 3']);

    const fpgas = await request(app).get('/resources?category=fpga');
    expect(fpgas.body.map((r) => r.name)).toEqual(['Basys 3']);
  });
});
