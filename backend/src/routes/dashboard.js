'use strict';

/**
 * src/routes/dashboard.js
 *
 * Dashboard KPI endpoint.
 * Mounted at /api/dashboard in server.js.
 *
 * Single endpoint that returns everything the dashboard landing page needs
 * in one round-trip. All numbers are derived from the ledger — nothing stored.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET  /api/dashboard/kpis
 *
 * Response shape:
 * {
 *   total_products:        number   — distinct active products
 *   low_stock_count:       number   — products where total stock ≤ reorder_threshold
 *   out_of_stock_count:    number   — products where total stock = 0
 *   pending_receipts:      number   — receipt docs with status != done/canceled (*)
 *   pending_deliveries:    number   — delivery docs with status != done/canceled (*)
 *   scheduled_transfers:   number   — transfer docs with status != done/canceled (*)
 *   recent_moves:          array    — last 10 ledger entries (for activity feed)
 *   low_stock_items:       array    — products currently below threshold
 * }
 *
 * (*) pending_receipts / deliveries / transfers are counted from ledger_entries
 *     grouped by reference_doc_id + operation_type until teammate 3 builds
 *     the dedicated receipts/deliveries/transfers tables. This gives the frontend
 *     real numbers immediately without waiting for that module.
 */

const { Router } = require('express');
const { query }  = require('../db/pool');

const router     = Router();
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.get('/kpis', asyncHandler(async (_req, res) => {

  // Run all queries in parallel for speed
  const [
    productsResult,
    stockSummaryResult,
    pendingOpsResult,
    recentMovesResult,
    lowStockItemsResult,
  ] = await Promise.all([

    // 1. Total active products
    query(`SELECT COUNT(*)::int AS total FROM products WHERE active = true`),

    // 2. Low stock + out of stock counts
    //    Join products with their derived total stock from ledger
    query(`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(stock, 0) <= p.reorder_threshold
            AND COALESCE(stock, 0) > 0
        )::int AS low_stock_count,
        COUNT(*) FILTER (
          WHERE COALESCE(stock, 0) = 0
        )::int AS out_of_stock_count
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(qty_delta)::numeric AS stock
        FROM   ledger_entries
        WHERE  status = 'done'
        GROUP  BY product_id
      ) s ON s.product_id = p.id
      WHERE p.active = true
    `),

    // 3. Pending operations — count distinct reference docs by type and non-terminal status
    //    This works until teammate 3 builds the business doc tables
    query(`
      SELECT
        operation_type,
        COUNT(DISTINCT reference_doc_id)::int AS pending_count
      FROM   ledger_entries
      WHERE  status NOT IN ('done', 'canceled')
      GROUP  BY operation_type
    `),

    // 4. Recent moves — last 10 ledger entries for activity feed
    query(`
      SELECT
        le.id             AS entry_id,
        le.qty_delta,
        le.operation_type,
        le.status,
        le.created_at,
        le.created_by,
        p.name            AS product_name,
        p.sku,
        l.name            AS location_name,
        l.code            AS location_code
      FROM   ledger_entries le
      JOIN   products  p ON p.id = le.product_id
      JOIN   locations l ON l.id = le.location_id
      ORDER  BY le.created_at DESC
      LIMIT  10
    `),

    // 5. Low stock items — products at or below threshold with their stock level
    query(`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.unit,
        p.reorder_threshold,
        COALESCE(s.stock, 0)::numeric AS total_stock
      FROM   products p
      LEFT   JOIN (
        SELECT product_id, SUM(qty_delta)::numeric AS stock
        FROM   ledger_entries
        WHERE  status = 'done'
        GROUP  BY product_id
      ) s ON s.product_id = p.id
      WHERE  p.active = true
        AND  COALESCE(s.stock, 0) <= p.reorder_threshold
      ORDER  BY COALESCE(s.stock, 0) ASC
      LIMIT  20
    `),
  ]);

  // Parse pending ops into named counts
  const pendingMap = { receipt: 0, delivery: 0, transfer: 0, adjustment: 0 };
  for (const row of pendingOpsResult.rows) {
    pendingMap[row.operation_type] = row.pending_count;
  }

  res.json({
    success: true,
    kpis: {
      total_products:      productsResult.rows[0].total,
      low_stock_count:     stockSummaryResult.rows[0].low_stock_count,
      out_of_stock_count:  stockSummaryResult.rows[0].out_of_stock_count,
      pending_receipts:    pendingMap.receipt,
      pending_deliveries:  pendingMap.delivery,
      scheduled_transfers: pendingMap.transfer,
    },
    recent_moves: recentMovesResult.rows.map(r => ({
      ...r,
      qty_delta: parseFloat(r.qty_delta),
    })),
    low_stock_items: lowStockItemsResult.rows.map(r => ({
      ...r,
      total_stock:       parseFloat(r.total_stock),
      reorder_threshold: parseFloat(r.reorder_threshold),
    })),
  });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/dashboard] Error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
