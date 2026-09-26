'use strict';

/**
 * src/events/lowStockEmitter.js
 *
 * Low-stock event system.
 *
 * After every postLedgerEntry() write, the ledger calls checkAndEmitLowStock().
 * If the new derived stock level is at or below the product's reorder_threshold,
 * a 'low_stock' event is emitted on this EventEmitter.
 *
 * The dashboard KPI module (or any other subscriber) listens like this:
 *
 *   const { lowStockEmitter, LOW_STOCK_EVENT } = require('./events/lowStockEmitter');
 *
 *   lowStockEmitter.on(LOW_STOCK_EVENT, (payload) => {
 *     // payload: { product_id, location_id, current_stock, reorder_threshold,
 *     //            product_name, sku, triggered_at }
 *     console.log(`⚠ Low stock: ${payload.sku} at location ${payload.location_id}`);
 *   });
 *
 * Design notes:
 *  • EventEmitter is in-process and synchronous — listeners fire before
 *    postLedgerEntry() returns, so the API response already reflects the alert.
 *  • For production you'd bridge this to a message queue (Redis pub/sub,
 *    SQS, etc.) but for a demo the EventEmitter is transparent and debuggable.
 */

const EventEmitter = require('events');
const { query }    = require('../db/pool');

// ── Emitter singleton ─────────────────────────────────────────────────────────

const lowStockEmitter = new EventEmitter();
lowStockEmitter.setMaxListeners(20); // allow plenty of dashboard subscribers

const LOW_STOCK_EVENT = 'low_stock';

// ── Threshold check ───────────────────────────────────────────────────────────

/**
 * Check the stock level against the product's reorder_threshold.
 * Emits LOW_STOCK_EVENT if current_stock <= reorder_threshold.
 *
 * Called automatically by postLedgerEntry() after every successful write —
 * callers do not need to invoke this directly.
 *
 * @param {string} productId
 * @param {string} locationId
 * @param {number} currentStock  - Already-computed new stock level
 * @param {import('pg').PoolClient} [client] - Optional: use inside a transaction
 * @returns {Promise<{ triggered: boolean, payload?: object }>}
 */
async function checkAndEmitLowStock(productId, locationId, currentStock, client) {
  // Fetch the product's reorder threshold and display fields
  const sql = `
    SELECT id, sku, name, reorder_threshold
    FROM   products
    WHERE  id = $1
  `;
  const exec   = client ? (t, p) => client.query(t, p) : query;
  const result = await exec(sql, [productId]);

  if (result.rows.length === 0) {
    // Product doesn't exist — shouldn't happen if FK constraint is healthy
    console.warn(`[lowStock] product ${productId} not found during threshold check`);
    return { triggered: false };
  }

  const product = result.rows[0];
  const threshold = parseFloat(product.reorder_threshold);

  if (currentStock <= threshold) {
    const payload = {
      product_id:        productId,
      location_id:       locationId,
      product_name:      product.name,
      sku:               product.sku,
      current_stock:     currentStock,
      reorder_threshold: threshold,
      triggered_at:      new Date().toISOString(),
    };

    console.warn(
      `[lowStock] ⚠  ${product.sku} "${product.name}" at location ${locationId}: `
      + `stock=${currentStock} ≤ threshold=${threshold}`
    );

    // Emit asynchronously to avoid blocking the HTTP response if a listener
    // does I/O; use setImmediate so the current call stack completes first.
    setImmediate(() => lowStockEmitter.emit(LOW_STOCK_EVENT, payload));

    return { triggered: true, payload };
  }

  return { triggered: false };
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  lowStockEmitter,
  LOW_STOCK_EVENT,
  checkAndEmitLowStock,
};
