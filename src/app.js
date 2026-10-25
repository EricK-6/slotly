const express = require('express');
const { pool } = require('./db');
const { errorHandler, notFoundHandler } = require('./errors');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
    next();
  });
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

// Express 5 forwards errors thrown in async handlers to errorHandler.
app.use('/resources', require('./routes/resources'));
app.use('/bookings', require('./routes/bookings'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
