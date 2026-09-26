'use strict';

/**
 * src/routes/receipts.js
 *
 * Receipts — incoming goods from suppliers.
 * Mounted at /api/receipts in server.js.
 *
 * Lifecycle:
 *   draft → waiting → ready → done (validate) → canceled
 *
 * Validating a receipt (POST /:id/validate) is what actually writes to the
 * ledger — stock increases only at that point, not when the receipt is created.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/receipts                List receipts (filterable)
 *  POST   /api/receipts                Create a receipt
 *  GET    /api/receipts/:id            Single receipt with lines
 *  PATCH  /api/receipts/:id            Update header fields (while draft)
 *  POST   /api/receipts/:id/lines      Add a product line
 *  DELETE /api/receipts/:id/lines/:lineId  Remove a line (while draft)
 *  POST   /api/receipts/:id/validate   Commit — writes ledger entries, stock increases
 *  POST   /api/receipts/:id/cancel     Cancel (if done, auto-reverses ledger)
 */

const { Router } = require('express');
const { query, withTransaction } = require('../db/pool');
const { postLedgerEntry }        = require('../ledger');

const router       = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getReceiptWithLines(id) {
  const { rows } = await query(
    `SELECT
       r.*,
       s.name              AS supplier_name,
       l.name              AS destination_name,
       l.code              AS destination_code
     FROM   receipts r
     LEFT   JOIN suppliers s ON s.id = r.supplier_id
     JOIN   locations  l ON l.id = r.destination_location_id
     WHERE  r.id = $1`,
    [id]
  );
  if (rows.length === 0) return null;

  const { rows: lines } = await query(
    `SELECT rl.*, p.name AS product_name, p.sku, p.unit
     FROM   receipt_lines rl
     JOIN   products p ON p.id = rl.product_id
     WHERE  rl.receipt_id = $1
     ORDER  BY rl.created_at`,
    [id]
  );

  return { ...rows[0], lines };
}

// ── GET /  — list receipts ────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const { status, location_id, supplier_id, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const params     = [];

  if (status)      { params.push(status);      conditions.push(`r.status = $${params.length}`); }
  if (location_id) { params.push(location_id); conditions.push(`r.destination_location_id = $${params.length}`); }
  if (supplier_id) { params.push(supplier_id); conditions.push(`r.supplier_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit, 10), 200));
  params.push(parseInt(offset, 10));

  const { rows } = await query(
    `SELECT
       r.*,
       s.name AS supplier_name,
       l.name AS destination_name,
       l.code AS destination_code,
       COUNT(rl.id)::int        AS line_count,
       COALESCE(SUM(rl.qty), 0)::numeric AS total_qty
     FROM   receipts r
     LEFT   JOIN suppliers     s  ON s.id  = r.supplier_id
     JOIN   locations          l  ON l.id  = r.destination_location_id
     LEFT   JOIN receipt_lines rl ON rl.receipt_id = r.id
     ${where}
     GROUP  BY r.id, s.name, l.name, l.code
     ORDER  BY r.created_at DESC
     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ success: true, count: rows.length, receipts: rows });
}));

// ── POST /  — create receipt ──────────────────────────────────────────────────

router.post('/', asyncHandler(async (req, res) => {
  const {
    supplier_id, destination_location_id,
    notes, expected_date, created_by,
  } = req.body;

  if (!destination_location_id)
    return res.status(400).json({ success: false, error: '`destination_location_id` is required' });
  if (!created_by)
    return res.status(400).json({ success: false, error: '`created_by` is required' });

  const { rows } = await query(
    `INSERT INTO receipts
       (reference, supplier_id, destination_location_id, notes, expected_date, created_by)
     VALUES (
       'REC-' || LPAD(nextval('receipt_seq')::text, 4, '0'),
       $1, $2, $3, $4, $5
     )
     RETURNING *`,
    [supplier_id || null, destination_location_id, notes || null, expected_date || null, created_by]
  );

  res.status(201).json({ success: true, receipt: rows[0] });
}));

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const receipt = await getReceiptWithLines(req.params.id);
  if (!receipt) return res.status(404).json({ success: false, error: 'Receipt not found' });
  res.json({ success: true, receipt });
}));

// ── PATCH /:id  — update header (draft only) ──────────────────────────────────

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: current } = await query('SELECT status FROM receipts WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Receipt not found' });
  if (current[0].status === 'done' || current[0].status === 'canceled')
    return res.status(422).json({ success: false, error: `Cannot edit a ${current[0].status} receipt` });

  const allowed = ['supplier_id', 'destination_location_id', 'notes', 'expected_date'];
  const fields  = [];
  const values  = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      values.push(req.body[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0)
    return res.status(400).json({ success: false, error: 'No updatable fields provided' });

  values.push(id);
  const { rows } = await query(
    `UPDATE receipts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  res.json({ success: true, receipt: rows[0] });
}));

// ── POST /:id/lines  — add a product line ─────────────────────────────────────

router.post('/:id/lines', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { product_id, qty } = req.body;

  if (!product_id) return res.status(400).json({ success: false, error: '`product_id` is required' });
  if (!qty || qty <= 0) return res.status(400).json({ success: false, error: '`qty` must be a positive number' });

  const { rows: current } = await query('SELECT status FROM receipts WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Receipt not found' });
  if (current[0].status !== 'draft' && current[0].status !== 'waiting')
    return res.status(422).json({ success: false, error: 'Can only add lines to draft or waiting receipts' });

  const { rows } = await query(
    `INSERT INTO receipt_lines (receipt_id, product_id, qty)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, product_id, qty]
  );
  res.status(201).json({ success: true, line: rows[0] });
}));

// ── DELETE /:id/lines/:lineId ─────────────────────────────────────────────────

router.delete('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const { id, lineId } = req.params;

  const { rows: current } = await query('SELECT status FROM receipts WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Receipt not found' });
  if (current[0].status !== 'draft' && current[0].status !== 'waiting')
    return res.status(422).json({ success: false, error: 'Cannot remove lines from a validated receipt' });

  await query('DELETE FROM receipt_lines WHERE id = $1 AND receipt_id = $2', [lineId, id]);
  res.json({ success: true, message: 'Line removed' });
}));

// ── POST /:id/validate  — commit receipt, write ledger ────────────────────────

router.post('/:id/validate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const receipt = await getReceiptWithLines(id);
  if (!receipt) return res.status(404).json({ success: false, error: 'Receipt not found' });
  if (receipt.status === 'done')
    return res.status(422).json({ success: false, error: 'Receipt already validated' });
  if (receipt.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Cannot validate a canceled receipt' });
  if (receipt.lines.length === 0)
    return res.status(422).json({ success: false, error: 'Receipt has no lines — add products before validating' });

  // Build one ledger entry per line
  const entries = receipt.lines.map(line => ({
    product_id:       line.product_id,
    location_id:      receipt.destination_location_id,
    qty_delta:        +parseFloat(line.qty),   // positive = stock IN
    operation_type:   'receipt',
    reference_doc_id: receipt.id,
    created_by:       created_by || receipt.created_by,
    status:           'done',
  }));

  // Post all lines atomically then mark the receipt as done
  const ledgerResult = await postLedgerEntry(entries);

  await query(
    `UPDATE receipts SET status = 'done' WHERE id = $1`,
    [id]
  );

  const updated = await getReceiptWithLines(id);
  res.json({
    success:          true,
    receipt:          updated,
    ledger_entries:   ledgerResult.entries,
    low_stock_alerts: ledgerResult.low_stock_alerts,
  });
}));

// ── POST /:id/cancel ──────────────────────────────────────────────────────────

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const receipt = await getReceiptWithLines(id);
  if (!receipt) return res.status(404).json({ success: false, error: 'Receipt not found' });
  if (receipt.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Receipt already canceled' });

  if (receipt.status === 'done') {
    // Reverse all ledger entries for this receipt
    const reversals = receipt.lines.map(line => ({
      product_id:       line.product_id,
      location_id:      receipt.destination_location_id,
      qty_delta:        -parseFloat(line.qty),   // negative = reverse the stock IN
      operation_type:   'receipt',
      reference_doc_id: receipt.id,
      created_by:       created_by || receipt.created_by,
      status:           'done',
    }));
    await postLedgerEntry(reversals);
  }

  await query(`UPDATE receipts SET status = 'canceled' WHERE id = $1`, [id]);
  res.json({ success: true, message: 'Receipt canceled', receipt_id: id });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/receipts] Error:', err.message);
  if (err.code === '23505') return res.status(409).json({ success: false, error: 'Duplicate reference' });
  const code = { VALIDATION_ERROR: 400, EMPTY_BATCH: 400 }[err.code] || 500;
  res.status(code).json({ success: false, error: err.message });
});

module.exports = router;
