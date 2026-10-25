class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Postgres error codes -> HTTP responses. The database is the source of truth
// for conflicts, so these are expected outcomes, not crashes.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
function fromPostgres(err) {
  switch (err.code) {
    case '23P01': // exclusion_violation (bookings_no_overlap)
      return new HttpError(409, 'booking_conflict', 'Resource is already booked for an overlapping time range');
    case '23505': // unique_violation
      return err.constraint === 'resources_name_key'
        ? new HttpError(409, 'resource_exists', 'A resource with this name already exists')
        : new HttpError(409, 'already_exists', 'A record with the same unique value already exists');
    case '23503': // foreign_key_violation
      return err.constraint === 'bookings_user_id_fkey'
        ? new HttpError(404, 'user_not_found', 'User not found')
        : new HttpError(404, 'not_found', 'Referenced record not found');
    case '23514': // check_violation
      return new HttpError(400, 'validation_failed', 'Value violates a database check constraint');
  }
  if (err.code?.startsWith('22')) {
    // data_exception class: bad timestamp, out-of-range number, ...
    return new HttpError(400, 'invalid_input', err.message);
  }
  return null;
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

// Express recognises error handlers by their four arguments, so `next` stays.
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    err = new HttpError(400, 'invalid_json', 'Request body is not valid JSON');
  } else if (!(err instanceof HttpError)) {
    err = fromPostgres(err) ?? err;
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}

module.exports = { HttpError, errorHandler, notFoundHandler };
