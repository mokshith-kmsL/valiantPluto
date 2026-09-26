'use strict';

/**
 * src/routes/history.js
 *
 * Move History — filtered view of ledger_entries.
 * Mounted at /api/history in server.js.
 *
 * This is the "Move History" nav item from the problem statement.
 * It surfaces every stock movement with rich filtering so the UI
 * can show a useful audit trail.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET  /api/history
 *
 *  Query params (all optional):
 *    operation_type  — receipt | delivery | transfer | adjustment
 *    status          — draft | waiting | ready | done | canceled
 *    location_id     — UUID
 *    product_id      — UUID
 *    search          — searches product name or SKU
 *    from            — ISO date string (created_at >= from)
 *    to              — ISO date string (created_at <= to)
 *    limit           — default 50, max 200
 *    offset          — default 0
 */

const { Router } = require('express');
const { query }  = require('../db/pool');

const router = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const {
    operation_type,
    status,
    location_id,
    product_id,
    search,
    from,
    to,
    limit  = 50,
    offset = 0,
  } = req.query;

  const conditions = [];
  const params     = [];

  if (operation_type) {
    params.push(operation_type);
    conditions.push(`le.operation_type = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`le.status = $${params.length}`);
  }
  if (location_id) {
    params.push(location_id);
    conditions.push(`le.location_id = $${params.length}`);
  }
  if (product_id) {
    params.push(product_id);
    conditions.push(`le.product_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (from) {
    params.push(from);
    conditions.push(`le.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`le.created_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query for pagination
  const countParams = [...params];
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total
     FROM   ledger_entries le
     JOIN   products  p ON p.id = le.product_id
     JOIN   locations l ON l.id = le.location_id
     ${where}`,
    countParams
  );
  const total = countRows[0].total;

  // Data query
  params.push(Math.min(parseInt(limit, 10), 200));
  params.push(parseInt(offset, 10));

  const { rows } = await query(
    `SELECT
       le.id             AS entry_id,
       le.qty_delta,
       le.operation_type,
       le.status,
       le.reference_doc_id,
       le.reverses_entry_id,
       le.created_at,
       le.created_by,
       p.id              AS product_id,
       p.sku,
       p.name            AS product_name,
       p.unit,
       l.id              AS location_id,
       l.name            AS location_name,
       l.code            AS location_code
     FROM   ledger_entries le
     JOIN   products  p ON p.id = le.product_id
     JOIN   locations l ON l.id = le.location_id
     ${where}
     ORDER  BY le.created_at DESC
     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    success: true,
    total,
    count:   rows.length,
    limit:   parseInt(limit, 10),
    offset:  parseInt(offset, 10),
    moves:   rows.map(r => ({
      ...r,
      qty_delta: parseFloat(r.qty_delta),
    })),
  });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/history] Error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
