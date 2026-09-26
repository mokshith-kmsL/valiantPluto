'use strict';

/**
 * src/ledger/index.js
 *
 * Public API surface for the Stock Ledger engine.
 *
 * Every other module — receipts, deliveries, transfers, adjustments,
 * the dashboard — imports from here, not from individual files.
 * This keeps the internal structure changeable without breaking callers.
 *
 * ─── What your teammate needs to call ────────────────────────────────────────
 *
 *   const {
 *     postLedgerEntry,       // Write entries (single or batch)
 *     transitionEntryStatus, // Advance status / cancel with reversal
 *     getStockLevel,         // Current qty for one product+location
 *     getStockByLocation,    // Breakdown across all locations for a product
 *     getTotalStock,         // Sum across all locations
 *     STATUS,                // Enum constants: STATUS.DONE, STATUS.DRAFT …
 *     canTransition,         // Check if a status move is legal
 *     lowStockEmitter,       // EventEmitter — subscribe to 'low_stock' events
 *     LOW_STOCK_EVENT,       // Event name constant
 *   } = require('./src/ledger');
 *
 * ─── Transfer example (atomic two-leg write) ─────────────────────────────────
 *
 *   const result = await postLedgerEntry([
 *     {
 *       product_id:       'prod-uuid',
 *       location_id:      'source-loc-uuid',
 *       qty_delta:        -50,           // stock OUT from source
 *       operation_type:   'transfer',
 *       reference_doc_id: 'transfer-doc-uuid',
 *       created_by:       'user-id',
 *     },
 *     {
 *       product_id:       'prod-uuid',
 *       location_id:      'dest-loc-uuid',
 *       qty_delta:        +50,           // stock IN at destination
 *       operation_type:   'transfer',
 *       reference_doc_id: 'transfer-doc-uuid',
 *       created_by:       'user-id',
 *     },
 *   ]);
 *   // Both entries commit together or both roll back — guaranteed.
 */

const { postLedgerEntry, transitionEntryStatus } = require('./postLedgerEntry');
const { getStockLevel, getStockByLocation, getTotalStock,
        invalidateStockCache, invalidateAllStockCache } = require('./stockLevel');
const { STATUS, canTransition, assertTransition,
        requiresReversal, countsAsStock }              = require('./stateMachine');
const { lowStockEmitter, LOW_STOCK_EVENT,
        checkAndEmitLowStock }                         = require('../events/lowStockEmitter');

module.exports = {
  // ── Core write ──────────────────────────────────────────────────────────────
  postLedgerEntry,
  transitionEntryStatus,

  // ── Stock reads ─────────────────────────────────────────────────────────────
  getStockLevel,
  getStockByLocation,
  getTotalStock,

  // ── Cache control (useful after bulk imports / data migrations) ─────────────
  invalidateStockCache,
  invalidateAllStockCache,

  // ── State machine helpers ───────────────────────────────────────────────────
  STATUS,
  canTransition,
  assertTransition,
  requiresReversal,
  countsAsStock,

  // ── Low-stock events ────────────────────────────────────────────────────────
  lowStockEmitter,
  LOW_STOCK_EVENT,
  checkAndEmitLowStock,
};
