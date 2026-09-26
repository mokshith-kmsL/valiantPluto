'use strict';

/**
 * src/routes/adjustments.js
 *
 * Stock Adjustments — fix discrepancies between recorded and physical stock.
 * Mounted at /api/adjustments in server.js.
 *
 * The key logic: you provide the TARGET quantity (what the physical count shows).
 * The system computes qty_delta = target - current_stock and posts that delta.
 * This means the ledger always shows WHY stock changed, not just that it did.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/adjustments           List adjustments
 *  POST   /api/adjustments           Create an adjustment
 *  GET    /api/adjustments/:id       Single adjustment
 *  POST   /api/adjustments/:id/validate  Commit — computes delta, writes ledger
 *  POST   /api/adjustments/:id/cancel    Cancel
 */

const { Router } = require('express');
const { query }  = require('../db/pool');
const { postLedgerEntry, getStockLevel } = require('../ledger');

const router       = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const { status, location_id, product_id, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const params     = [];

  if (status)      { params.push(status);      conditions.push(`a.status = $${params.length}`); }
  if (location_id) { params.push(location_id); conditions.push(`a.location_id = $${params.length}`); }
  if (product_id)  { params.push(product_id);  conditions.push(`a.product_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit, 10), 200));
  params.push(parseInt(offset, 10));

  const { rows } = await query(
    `SELECT
       a.*,
       p.name AS product_name, p.sku, p.unit,
       l.name AS location_name, l.code AS location_code
     FROM   adjustments a
     JOIN   products  p ON p.id = a.product_id
     JOIN   locations l ON l.id = a.location_id
     ${where}
     ORDER  BY a.created_at DESC
     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ success: true, count: rows.length, adjustments: rows });
}));

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', asyncHandler(async (req, res) => {
  const { product_id, location_id, target_qty, reason, created_by } = req.body;

  if (!product_id)             return res.status(400).json({ success: false, error: '`product_id` is required' });
  if (!location_id)            return res.status(400).json({ success: false, error: '`location_id` is required' });
  if (target_qty === undefined) return res.status(400).json({ success: false, error: '`target_qty` is required' });
  if (target_qty < 0)          return res.status(400).json({ success: false, error: '`target_qty` cannot be negative' });
  if (!created_by)             return res.status(400).json({ success: false, error: '`created_by` is required' });

  // Snapshot current stock at creation time (informational)
  const currentStock = await getStockLevel(product_id, location_id);
  const delta        = parseFloat(target_qty) - currentStock;

  if (delta === 0) {
    return res.status(422).json({
      success: false,
      error:   `Stock is already ${currentStock} — no adjustment needed`,
    });
  }

  const { rows } = await query(
    `INSERT INTO adjustments
       (reference, product_id, location_id, target_qty, qty_delta, reason, created_by)
     VALUES (
       'ADJ-' || LPAD(nextval('adjustment_seq')::text, 4, '0'),
       $1, $2, $3, $4, $5, $6
     )
     RETURNING *`,
    [product_id, location_id, target_qty, delta, reason || null, created_by]
  );

  res.status(201).json({
    success:       true,
    adjustment:    rows[0],
    current_stock: currentStock,
    qty_delta:     delta,
  });
}));

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
       a.*,
       p.name AS product_name, p.sku, p.unit,
       l.name AS location_name, l.code AS location_code
     FROM   adjustments a
     JOIN   products  p ON p.id = a.product_id
     JOIN   locations l ON l.id = a.location_id
     WHERE  a.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Adjustment not found' });

  const adj = rows[0];
  // Show live current stock alongside the recorded target
  const currentStock = await getStockLevel(adj.product_id, adj.location_id);

  res.json({
    success:       true,
    adjustment:    adj,
    current_stock: currentStock,
  });
}));

// ── POST /:id/validate ────────────────────────────────────────────────────────

router.post('/:id/validate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const { rows } = await query(
    `SELECT a.*, p.name AS product_name
     FROM adjustments a JOIN products p ON p.id = a.product_id
     WHERE a.id = $1`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Adjustment not found' });
  const adj = rows[0];

  if (adj.status === 'done')
    return res.status(422).json({ success: false, error: 'Adjustment already validated' });
  if (adj.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Cannot validate a canceled adjustment' });

  // Recompute delta at validation time against CURRENT stock
  // (stock may have changed since the adjustment was drafted)
  const currentStock = await getStockLevel(adj.product_id, adj.location_id);
  const delta        = parseFloat(adj.target_qty) - currentStock;

  if (delta === 0) {
    // Stock already matches target — mark done with no ledger write needed
    await query(`UPDATE adjustments SET status = 'done', qty_delta = 0 WHERE id = $1`, [id]);
    return res.json({
      success:       true,
      message:       'Stock already matches target — no ledger entry needed',
      current_stock: currentStock,
      target_qty:    parseFloat(adj.target_qty),
    });
  }

  // Write the delta to the ledger
  const ledgerResult = await postLedgerEntry({
    product_id:       adj.product_id,
    location_id:      adj.location_id,
    qty_delta:        delta,
    operation_type:   'adjustment',
    reference_doc_id: adj.id,
    created_by:       created_by || adj.created_by,
    status:           'done',
  });

  // Store the actual delta applied and mark done
  await query(
    `UPDATE adjustments SET status = 'done', qty_delta = $1 WHERE id = $2`,
    [delta, id]
  );

  res.json({
    success:          true,
    adjustment:       { ...adj, status: 'done', qty_delta: delta },
    ledger_entry:     ledgerResult.entries[0],
    previous_stock:   currentStock,
    new_stock:        ledgerResult.entries[0].new_stock_at_location,
    low_stock_alerts: ledgerResult.low_stock_alerts,
  });
}));

// ── POST /:id/cancel ──────────────────────────────────────────────────────────

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const { rows } = await query('SELECT * FROM adjustments WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Adjustment not found' });
  const adj = rows[0];

  if (adj.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Adjustment already canceled' });

  if (adj.status === 'done' && adj.qty_delta && parseFloat(adj.qty_delta) !== 0) {
    // Reverse the delta that was applied
    await postLedgerEntry({
      product_id:       adj.product_id,
      location_id:      adj.location_id,
      qty_delta:        -parseFloat(adj.qty_delta),
      operation_type:   'adjustment',
      reference_doc_id: adj.id,
      created_by:       created_by || adj.created_by,
      status:           'done',
    });
  }

  await query(`UPDATE adjustments SET status = 'canceled' WHERE id = $1`, [id]);
  res.json({ success: true, message: 'Adjustment canceled', adjustment_id: id });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/adjustments] Error:', err.message);
  const code = { VALIDATION_ERROR: 400, EMPTY_BATCH: 400 }[err.code] || 500;
  res.status(code).json({ success: false, error: err.message });
});

module.exports = router;
