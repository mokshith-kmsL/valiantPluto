'use strict';

/**
 * src/routes/deliveries.js
 *
 * Deliveries — outgoing goods to customers.
 * Mounted at /api/deliveries in server.js.
 *
 * Validating a delivery reduces stock at the source location.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/deliveries                 List deliveries
 *  POST   /api/deliveries                 Create a delivery
 *  GET    /api/deliveries/:id             Single delivery with lines
 *  PATCH  /api/deliveries/:id             Update header (while draft)
 *  POST   /api/deliveries/:id/lines       Add a product line
 *  DELETE /api/deliveries/:id/lines/:lineId  Remove a line (while draft)
 *  POST   /api/deliveries/:id/validate    Commit — stock decreases
 *  POST   /api/deliveries/:id/cancel      Cancel (reverses stock if done)
 */

const { Router } = require('express');
const { query }          = require('../db/pool');
const { postLedgerEntry, getStockLevel } = require('../ledger');

const router       = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getDeliveryWithLines(id) {
  const { rows } = await query(
    `SELECT
       d.*,
       l.name AS source_name,
       l.code AS source_code
     FROM   deliveries d
     JOIN   locations l ON l.id = d.source_location_id
     WHERE  d.id = $1`,
    [id]
  );
  if (rows.length === 0) return null;

  const { rows: lines } = await query(
    `SELECT dl.*, p.name AS product_name, p.sku, p.unit
     FROM   delivery_lines dl
     JOIN   products p ON p.id = dl.product_id
     WHERE  dl.delivery_id = $1
     ORDER  BY dl.created_at`,
    [id]
  );

  return { ...rows[0], lines };
}

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const { status, location_id, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const params     = [];

  if (status)      { params.push(status);      conditions.push(`d.status = $${params.length}`); }
  if (location_id) { params.push(location_id); conditions.push(`d.source_location_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit, 10), 200));
  params.push(parseInt(offset, 10));

  const { rows } = await query(
    `SELECT
       d.*,
       l.name AS source_name,
       l.code AS source_code,
       COUNT(dl.id)::int            AS line_count,
       COALESCE(SUM(dl.qty), 0)::numeric AS total_qty
     FROM   deliveries d
     JOIN   locations       l  ON l.id = d.source_location_id
     LEFT   JOIN delivery_lines dl ON dl.delivery_id = d.id
     ${where}
     GROUP  BY d.id, l.name, l.code
     ORDER  BY d.created_at DESC
     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ success: true, count: rows.length, deliveries: rows });
}));

// ── POST / ────────────────────────────────────────────────────────────────────

router.post('/', asyncHandler(async (req, res) => {
  const { source_location_id, customer_name, notes, scheduled_date, created_by } = req.body;

  if (!source_location_id)
    return res.status(400).json({ success: false, error: '`source_location_id` is required' });
  if (!created_by)
    return res.status(400).json({ success: false, error: '`created_by` is required' });

  const { rows } = await query(
    `INSERT INTO deliveries
       (reference, source_location_id, customer_name, notes, scheduled_date, created_by)
     VALUES (
       'DEL-' || LPAD(nextval('delivery_seq')::text, 4, '0'),
       $1, $2, $3, $4, $5
     )
     RETURNING *`,
    [source_location_id, customer_name || null, notes || null, scheduled_date || null, created_by]
  );

  res.status(201).json({ success: true, delivery: rows[0] });
}));

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const delivery = await getDeliveryWithLines(req.params.id);
  if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });
  res.json({ success: true, delivery });
}));

// ── PATCH /:id ────────────────────────────────────────────────────────────────

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: current } = await query('SELECT status FROM deliveries WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Delivery not found' });
  if (['done', 'canceled'].includes(current[0].status))
    return res.status(422).json({ success: false, error: `Cannot edit a ${current[0].status} delivery` });

  const allowed = ['source_location_id', 'customer_name', 'notes', 'scheduled_date'];
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
    `UPDATE deliveries SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  res.json({ success: true, delivery: rows[0] });
}));

// ── POST /:id/lines ───────────────────────────────────────────────────────────

router.post('/:id/lines', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { product_id, qty } = req.body;

  if (!product_id) return res.status(400).json({ success: false, error: '`product_id` is required' });
  if (!qty || qty <= 0) return res.status(400).json({ success: false, error: '`qty` must be a positive number' });

  const { rows: current } = await query('SELECT status FROM deliveries WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Delivery not found' });
  if (!['draft', 'waiting'].includes(current[0].status))
    return res.status(422).json({ success: false, error: 'Can only add lines to draft or waiting deliveries' });

  const { rows } = await query(
    `INSERT INTO delivery_lines (delivery_id, product_id, qty) VALUES ($1, $2, $3) RETURNING *`,
    [id, product_id, qty]
  );
  res.status(201).json({ success: true, line: rows[0] });
}));

// ── DELETE /:id/lines/:lineId ─────────────────────────────────────────────────

router.delete('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const { id, lineId } = req.params;
  const { rows: current } = await query('SELECT status FROM deliveries WHERE id = $1', [id]);
  if (current.length === 0) return res.status(404).json({ success: false, error: 'Delivery not found' });
  if (!['draft', 'waiting'].includes(current[0].status))
    return res.status(422).json({ success: false, error: 'Cannot remove lines from a validated delivery' });

  await query('DELETE FROM delivery_lines WHERE id = $1 AND delivery_id = $2', [lineId, id]);
  res.json({ success: true, message: 'Line removed' });
}));

// ── POST /:id/validate ────────────────────────────────────────────────────────

router.post('/:id/validate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const delivery = await getDeliveryWithLines(id);
  if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });
  if (delivery.status === 'done')
    return res.status(422).json({ success: false, error: 'Delivery already validated' });
  if (delivery.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Cannot validate a canceled delivery' });
  if (delivery.lines.length === 0)
    return res.status(422).json({ success: false, error: 'Delivery has no lines' });

  // Stock availability check before writing anything
  const stockChecks = await Promise.all(
    delivery.lines.map(async line => {
      const available = await getStockLevel(line.product_id, delivery.source_location_id);
      return { line, available, sufficient: available >= parseFloat(line.qty) };
    })
  );

  const insufficient = stockChecks.filter(c => !c.sufficient);
  if (insufficient.length > 0) {
    return res.status(422).json({
      success: false,
      error:   'Insufficient stock for one or more lines',
      details: insufficient.map(c => ({
        product_id:   c.line.product_id,
        product_name: c.line.product_name,
        sku:          c.line.sku,
        requested:    parseFloat(c.line.qty),
        available:    c.available,
      })),
    });
  }

  // All good — write ledger entries
  const entries = delivery.lines.map(line => ({
    product_id:       line.product_id,
    location_id:      delivery.source_location_id,
    qty_delta:        -parseFloat(line.qty),   // negative = stock OUT
    operation_type:   'delivery',
    reference_doc_id: delivery.id,
    created_by:       created_by || delivery.created_by,
    status:           'done',
  }));

  const ledgerResult = await postLedgerEntry(entries);

  await query(`UPDATE deliveries SET status = 'done' WHERE id = $1`, [id]);

  const updated = await getDeliveryWithLines(id);
  res.json({
    success:          true,
    delivery:         updated,
    ledger_entries:   ledgerResult.entries,
    low_stock_alerts: ledgerResult.low_stock_alerts,
  });
}));

// ── POST /:id/cancel ──────────────────────────────────────────────────────────

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  const delivery = await getDeliveryWithLines(id);
  if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });
  if (delivery.status === 'canceled')
    return res.status(422).json({ success: false, error: 'Delivery already canceled' });

  if (delivery.status === 'done') {
    const reversals = delivery.lines.map(line => ({
      product_id:       line.product_id,
      location_id:      delivery.source_location_id,
      qty_delta:        +parseFloat(line.qty),   // positive = reverse the stock OUT
      operation_type:   'delivery',
      reference_doc_id: delivery.id,
      created_by:       created_by || delivery.created_by,
      status:           'done',
    }));
    await postLedgerEntry(reversals);
  }

  await query(`UPDATE deliveries SET status = 'canceled' WHERE id = $1`, [id]);
  res.json({ success: true, message: 'Delivery canceled', delivery_id: id });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/deliveries] Error:', err.message);
  const code = { VALIDATION_ERROR: 400, EMPTY_BATCH: 400 }[err.code] || 500;
  res.status(code).json({ success: false, error: err.message });
});

module.exports = router;
