const express = require('express');
const { pool } = require('../db');
const { rules, validateBody } = require('../validate');

const router = express.Router();
const COLUMNS = 'id, name, category, location, max_booking_minutes, created_at';

// GET /resources?category=fpga
router.get('/', async (req, res) => {
  const { category } = req.query;
  const { rows } = category
    ? await pool.query(`SELECT ${COLUMNS} FROM resources WHERE category = $1 ORDER BY id`, [String(category)])
    : await pool.query(`SELECT ${COLUMNS} FROM resources ORDER BY id`);
  res.json(rows);
});

// POST /resources { name, category, location?, max_booking_minutes? }
router.post('/', async (req, res) => {
  const body = validateBody(req.body, {
    name: [rules.text(100)],
    category: [rules.text(50)],
    location: [rules.text(100), { optional: true }],
    max_booking_minutes: [rules.minutes, { optional: true }],
  });

  const { rows } = await pool.query(
    `INSERT INTO resources (name, category, location, max_booking_minutes)
     VALUES ($1, $2, $3, COALESCE($4, 240))
     RETURNING ${COLUMNS}`,
    [body.name.trim(), body.category.trim(), body.location?.trim() ?? null, body.max_booking_minutes ?? null],
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
