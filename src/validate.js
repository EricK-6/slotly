// Small hand-rolled validators. Each returns an error string or null.
const { HttpError } = require('./errors');

// ISO 8601 with an explicit offset, e.g. 2026-11-02T09:00:00Z or 2026-11-02T09:00+01:00.
// Requiring the offset avoids silently guessing a timezone.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_INT = 2147483647;

const rules = {
  id: (v) => (Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER ? null : 'must be a positive integer'),
  text: (max) => (v) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= max ? null : `must be a non-empty string (max ${max} chars)`,
  minutes: (v) => (Number.isInteger(v) && v > 0 && v <= MAX_INT ? null : 'must be a positive integer'),
  timestamp: (v) =>
    typeof v === 'string' && ISO_TIMESTAMP.test(v) && !Number.isNaN(Date.parse(v))
      ? null
      : 'must be an ISO 8601 timestamp with timezone, e.g. 2026-11-02T09:00:00Z',
};

// schema: { field: [rule, { optional: true }] }. Throws one 400 listing every problem.
function validateBody(body, schema) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'validation_failed', 'Request body must be a JSON object');
  }
  const problems = [];
  for (const [field, [rule, opts = {}]] of Object.entries(schema)) {
    const value = body[field];
    if (value === undefined || value === null) {
      if (!opts.optional) problems.push(`${field} is required`);
      continue;
    }
    const problem = rule(value);
    if (problem) problems.push(`${field} ${problem}`);
  }
  if (problems.length) throw new HttpError(400, 'validation_failed', problems.join('; '));
  return body;
}

// For ids that arrive as strings in the URL path or query string.
function parseId(value, name) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value)) {
    throw new HttpError(400, 'validation_failed', `${name} must be a positive integer`);
  }
  return Number(value);
}

module.exports = { rules, validateBody, parseId };
