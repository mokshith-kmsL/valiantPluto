'use strict';

/**
 * src/routes/locations.js
 *
 * Warehouse / location management API.
 * Mounted at /api/locations in server.js.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/locations         List all locations
 *  POST   /api/locations         Create a location
 *  GET    /api/locations/:id     Single location + stock summary
 *  PATCH  /api/locations/:id     Update location name/description
 */

const { Router } = require('express');
const { query }  = require('../db/pool');

const router = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── GET /  — list all locations ───────────────────────────────────────────────

router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT
       l.id,
       l.name,
       l.code,
       l.description,
       l.created_at,
       -- How many distinct products have stock here
       COUNT(DISTINCT le.product_id) FILTER (
         WHERE le.status = 'done'
       )::int AS active_product_count
     FROM   locations l
     LEFT   JOIN ledger_entries le ON le.location_id = l.id
     GROUP  BY l.id
     ORDER  BY l.name`
  );
  res.json({ success: true, locations: rows });
}));

// ── POST /  — create location ─────────────────────────────────────────────────

router.post('/', asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;

  if (!name) return res.status(400).json({ success: false, error: '`name` is required' });
  if (!code) return res.status(400).json({ success: false, error: '`code` is required' });

  const { rows } = await query(
    `INSERT INTO locations (name, code, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, code.toUpperCase(), description || null]
  );
  res.status(201).json({ success: true, location: rows[0] });
}));

// ── GET /:id  — single location with per-product stock ───────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(
    `SELECT id, name, code, description, created_at FROM locations WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ success: false, error: `Location ${id} not found` });
  }

  const location = rows[0];

  // Stock of every product at this location (derived from ledger)
  const { rows: stockRows } = await query(
    `SELECT
       p.id          AS product_id,
       p.sku,
       p.name        AS product_name,
       p.unit,
       p.reorder_threshold,
       COALESCE(SUM(le.qty_delta), 0)::numeric AS stock
     FROM   products p
     LEFT   JOIN ledger_entries le
                ON  le.product_id  = p.id
                AND le.location_id = $1
                AND le.status      = 'done'
     WHERE  p.active = true
     GROUP  BY p.id
     HAVING COALESCE(SUM(le.qty_delta), 0) > 0
     ORDER  BY p.name`,
    [id]
  );

  res.json({
    success:  true,
    location: {
      ...location,
      stock: stockRows.map(r => ({
        ...r,
        stock:             parseFloat(r.stock),
        reorder_threshold: parseFloat(r.reorder_threshold),
        is_low_stock:      parseFloat(r.stock) <= parseFloat(r.reorder_threshold),
      })),
    },
  });
}));

// ── PATCH /:id  — update location ─────────────────────────────────────────────

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const fields = [];
  const values = [];

  if (name)        { values.push(name);        fields.push(`name = $${values.length}`); }
  if (description) { values.push(description); fields.push(`description = $${values.length}`); }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, error: 'No updatable fields provided' });
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE locations SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, error: `Location ${id} not found` });
  }

  res.json({ success: true, location: rows[0] });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/locations] Error:', err.message);
  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: 'A location with that code already exists' });
  }
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
