const app = require('./app');
const { pool } = require('./db');

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log(`slotly listening on :${port}`));

// Finish in-flight requests and close DB connections when the container stops.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
