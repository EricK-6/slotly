const request = require('supertest');
const app = require('../src/app');
const { pool } = require('./helpers');

afterAll(() => pool.end());

test('GET /health reports the database as up', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', database: 'up' });
});

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/nope');
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe('not_found');
});

test('malformed JSON returns 400 instead of crashing', async () => {
  const res = await request(app).post('/resources').set('content-type', 'application/json').send('{bad');
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('invalid_json');
});
