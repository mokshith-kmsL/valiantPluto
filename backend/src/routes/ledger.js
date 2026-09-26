'use strict';

/**
 * src/routes/ledger.js
 *
 * Express router — exposes the Ledger engine over HTTP.
 * Mounted at /api/ledger in server.js.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  POST   /api/ledger/entries
 *    Post one or more ledger entries (single object or array).
 *    Body: SingleEntry | SingleEntry[]
 *    → { success, entries[], low_stock_alerts[] }
 *
 *  GET    /api/ledger/stock/:productId/:locationId
 *    Derived stock level for a product at one location.
 *    → { product_id, location_id, stock }
 *
 *  GET    /api/ledger/stock/:productId
 *    Stock breakdown across all locations + total.
 *    → { product_id, total_stock, by_location[] }
 *
 *  GET    /api/ledger/entries/:productId
 *    Full ledger history for a product (all locations, newest first).
 *    → { product_id, entries[] }
 *
 *  PATCH  /api/ledger/entries/:entryId/status
 *    Advance an entry to a new status (state machine enforced).
 *    Canceling a 'done' entry auto-creates a reversing entry.
 *    Body: { status: string, actor_id?: string }
 *    → { success, entry, reversal? }
 *
 *  GET    /api/ledger/entries/:productId/:locationId
 *    Ledger history for a specific product + location combo.
 *    → { product_id, location_id, entries[] }
 */

const { Router } = require('express');
const {
  postLedgerEntry,
  transitionEntryStatus,
  getStockLevel,
  getStockByLocation,
  getTotalStock,
  canTransition,
} = require('../ledger');
const { query } = require('../db/pool');

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wrap async route handlers — catches thrown errors and forwards to Express
 * error middleware so we don't need try/catch in every handler.
 */
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── POST /entries ─────────────────────────────────────────────────────────────

router.post('/entries', asyncHandler(async (req, res) => {
  const payload = req.body;

  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
    return res.status(400).json({ success: false, error: 'Request body is required' });
  }

  const result = await postLedgerEntry(payload);
  return res.status(201).json(result);
}));

// ── GET /stock/:productId/:locationId ─────────────────────────────────────────

router.get('/stock/:productId/:locationId', asyncHandler(async (req, res) => {
  const { productId, locationId } = req.params;
  const stock = await getStockLevel(productId, locationId);
  return res.json({
    product_id:  productId,
    location_id: locationId,
    stock,
  });
}));

// ── GET /stock/:productId  (all locations) ────────────────────────────────────

router.get('/stock/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const [byLocation, totalStock] = await Promise.all([
    getStockByLocation(productId),
    getTotalStock(productId),
  ]);
  return res.json({
    product_id:  productId,
    total_stock: totalStock,
    by_location: byLocation,
  });
}));

// ── GET /entries/:productId  (full history) ───────────────────────────────────

router.get('/entries/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
  const offset = parseInt(req.query.offset || '0', 10);

  const { rows } = await query(
    `SELECT
       le.*,
       l.name  AS location_name,
       l.code  AS location_code
     FROM   ledger_entries le
     JOIN   locations l ON l.id = le.location_id
     WHERE  le.product_id = $1
     ORDER  BY le.created_at DESC
     LIMIT  $2 OFFSET $3`,
    [productId, limit, offset]
  );

  return res.json({
    product_id: productId,
    count:      rows.length,
    limit,
    offset,
    entries:    rows,
  });
}));

// ── GET /entries/:productId/:locationId  (history for one location) ───────────

router.get('/entries/:productId/:locationId', asyncHandler(async (req, res) => {
  const { productId, locationId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
  const offset = parseInt(req.query.offset || '0', 10);

  const { rows } = await query(
    `SELECT *
     FROM   ledger_entries
     WHERE  product_id  = $1
       AND  location_id = $2
     ORDER  BY created_at DESC
     LIMIT  $3 OFFSET $4`,
    [productId, locationId, limit, offset]
  );

  return res.json({
    product_id:  productId,
    location_id: locationId,
    count:       rows.length,
    limit,
    offset,
    entries:     rows,
  });
}));

// ── PATCH /entries/:entryId/status ────────────────────────────────────────────

router.patch('/entries/:entryId/status', asyncHandler(async (req, res) => {
  const { entryId } = req.params;
  const { status: newStatus, actor_id } = req.body;

  if (!newStatus) {
    return res.status(400).json({ success: false, error: '`status` is required in request body' });
  }

  // Pre-check: fetch current status to give a helpful 400 before hitting the DB
  const { rows } = await query(
    'SELECT status FROM ledger_entries WHERE id = $1',
    [entryId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ success: false, error: `Entry ${entryId} not found` });
  }

  const currentStatus = rows[0].status;
  const { valid, reason } = canTransition(currentStatus, newStatus);
  if (!valid) {
    return res.status(422).json({ success: false, error: reason });
  }

  const result = await transitionEntryStatus(entryId, newStatus, actor_id || 'api');
  return res.json(result);
}));

// ── Error handler (scoped to this router) ─────────────────────────────────────

router.use((err, req, res, _next) => {
  console.error('[routes/ledger] Error:', err.message);

  const statusCode = {
    VALIDATION_ERROR:          400,
    EMPTY_BATCH:               400,
    ENTRY_NOT_FOUND:           404,
    INVALID_STATUS_TRANSITION: 422,
  }[err.code] || 500;

  return res.status(statusCode).json({
    success: false,
    error:   err.message,
    ...(err.errors ? { errors: err.errors } : {}),
  });
});

module.exports = router;
