'use strict';

/**
 * src/routes/transfers.js
 *
 * Internal Transfers — move stock between locations.
 * Mounted at /api/transfers in server.js.
 *
 * Validating a transfer posts TWO ledger entries atomically:
 *   -qty at from_location  (stock out)
 *   +qty at to_location    (stock in)
 * Both succeed or both roll back. Stock total across locations is unchanged.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/transfers          List transfers
 *  POST   /api/transfers          Create a transfer
 *  GET    /api/transfers/:id      Single transfer
 *  PATCH  /api/transfers/:id      Update (while draft)
 *  POST   /api/transfers/:id/validate  Commit — atomic two-leg ledger write
 *  POST   /api/transfers/:id/cancel    Cancel
 */

const { Router } = require('express');
const { query }  = require('../db/pool');
const { postLedgerEntry, getStockLevel } = require('../ledger');

const router       = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const { status, from_location_id, to_location_id, product_id, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const params     = [];

  if (status)           { params.push(status);           conditions.push(`t.status = $${params.length}`); }
  if (from_location_id) { params.push(from_location_id); conditions.push(`t.from_location_id = $${params.length}`); }
  if (to_location_id)   { params.push(to_location_id);   conditions.push(`t.to_location_id = $${params.length}`); }
  if (product_id)       { params.push(product_id);       conditions.push(`t.product_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit, 10), 200));
  params.push(parseInt(offset, 10));

  const { rows } = await query(
    `SELECT
       t.*,
       p.name AS product_name,
       p.sku,
       p.unit,
       fl.name AS from_location_name,
       fl.code AS from_location_code,
       tl.name AS to_location_name,
       tl.code AS to_location_code
     FROM   transfers t
     JOIN   products  p  ON p.id  = t.product_id
     JOIN   locations fl ON fl.id = t.from_location_id
     JOIN   locations tl ON tl.id = t.to_location_id
     ${where}
     ORDER  BY t.created_at DESC
     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ success: true, count: rows.length, transfers: rows });
}));

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', asyncHandler(async (req, res) => {
  const {
    from_location_id, to_location_id,
    product_id, qty,
    notes, scheduled_date, created_by,
  } = req.body;

  if (!from_location_id) return res.status(400).json({ success: false, error: '`from_location_id` is required' });
  if (!to_location_id)   return res.status(400).json({ success: false, error: '`to_location_id` is required' });
  if (!product_id)       return res.status(400).json({ success: false, error: '`product_id` is required' });
  if (!qty || qty <= 0)  return res.status(400).json({ success: false, error: '`qty` must be a positive number' });
  if (!created_by)       return res.status(400).json({ success: false, error: '`created_by` is required' });
  if (from_location_id === to_location_id)
    return res.status(400).json({ success: false, error: 'Source and destination locations must be different' });

  const { rows } = await query(
    `INSERT INTO transfers
       (reference, from_location_id, to_location_id, product_id, qty, notes, scheduled_date, created_by)
     VALUES (
       'TRF-' || LPAD(nextval('transfer_seq')::text, 4, '0'),
       $1, $2, $3, $4, $5, $6, $7
     )
     RETURNING *`,
    [from_location_id, to_location_id, product_id, qty, notes || null, scheduled_date || null, created_by]
  );

  res.status(201).json({ success: true, transfer: rows[0] });
}));

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
       t.*,
       p.name AS product_name, p.sku, p.unit,
       fl.name AS from_location_name, fl.code AS from_location_code,
       tl.name AS to_location_name,   tl.code AS to_location_code
     FROM   transfers t
     JOIN   products  p  ON p.id  = t.product_id
     JOIN   locations fl ON fl.id = t.from_location_id
     JOIN   locations tl ON tl.id = t.to_location_id
     WHERE  t.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });
  res.json({ success: true, transfer: rows[0] });
}));

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: current } = await query('SELECT status FROM transfers WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });
  if (['done', 'canceled'].includes(current[0].status))
    return res.status(422).json({ success: false, error: `Cannot edit a ${current[0].status} transfer` });

  const allowed = ['qty', 'notes', 'scheduled_date'];
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
    `UPDATE transfers SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  res.json({ success: true, transfer: rows[0] });
}));

// ── POST /:id/validate ────────────────────────────────────────────────────────

router.post('/:id/validate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const { rows } = await query(
    `SELECT t.*, p.name AS product_name, p.sku
     FROM transfers t JOIN products p ON p.id = t.product_id
     WHERE t.id = $1`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });
  const transfer = rows[0];

  if (transfer.status === 'done')
    return res.status(422).json({ success: false, error: 'Transfer already validated' });
  if (transfer.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Cannot validate a canceled transfer' });

  // Stock availability check at source location
  const available = await getStockLevel(transfer.product_id, transfer.from_location_id);
  if (available < parseFloat(transfer.qty)) {
    return res.status(422).json({
      success:   false,
      error:     'Insufficient stock at source location',
      details: {
        product_name:      transfer.product_name,
        sku:               transfer.sku,
        requested:         parseFloat(transfer.qty),
        available_at_source: available,
      },
    });
  }

  // Atomic two-leg ledger write — this is the critical part
  // Both entries land together or neither does
  const ledgerResult = await postLedgerEntry([
    {
      product_id:       transfer.product_id,
      location_id:      transfer.from_location_id,
      qty_delta:        -parseFloat(transfer.qty),   // OUT from source
      operation_type:   'transfer',
      reference_doc_id: transfer.id,
      created_by:       created_by || transfer.created_by,
      status:           'done',
    },
    {
      product_id:       transfer.product_id,
      location_id:      transfer.to_location_id,
      qty_delta:        +parseFloat(transfer.qty),   // IN at destination
      operation_type:   'transfer',
      reference_doc_id: transfer.id,
      created_by:       created_by || transfer.created_by,
      status:           'done',
    },
  ]);

  await query(`UPDATE transfers SET status = 'done' WHERE id = $1`, [id]);

  res.json({
    success:          true,
    transfer:         { ...transfer, status: 'done' },
    ledger_entries:   ledgerResult.entries,
    low_stock_alerts: ledgerResult.low_stock_alerts,
  });
}));

// ── POST /:id/cancel ──────────────────────────────────────────────────────────

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const { rows } = await query('SELECT * FROM transfers WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });
  const transfer = rows[0];

  if (transfer.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Transfer already canceled' });

  if (transfer.status === 'done') {
    // Reverse both legs
    await postLedgerEntry([
      {
        product_id:       transfer.product_id,
        location_id:      transfer.from_location_id,
        qty_delta:        +parseFloat(transfer.qty),   // reverse: put back at source
        operation_type:   'transfer',
        reference_doc_id: transfer.id,
        created_by:       created_by || transfer.created_by,
        status:           'done',
      },
      {
        product_id:       transfer.product_id,
        location_id:      transfer.to_location_id,
        qty_delta:        -parseFloat(transfer.qty),   // reverse: remove from dest
        operation_type:   'transfer',
        reference_doc_id: transfer.id,
        created_by:       created_by || transfer.created_by,
        status:           'done',
      },
    ]);
  }

  await query(`UPDATE transfers SET status = 'canceled' WHERE id = $1`, [id]);
  res.json({ success: true, message: 'Transfer canceled', transfer_id: id });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/transfers] Error:', err.message);
  const code = { VALIDATION_ERROR: 400, EMPTY_BATCH: 400 }[err.code] || 500;
  res.status(code).json({ success: false, error: err.message });
});

module.exports = router;
