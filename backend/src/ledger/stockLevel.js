'use strict';

/**
 * src/ledger/stockLevel.js
 *
 * Derived stock calculation — NEVER stores stock as a mutable field.
 *
 * getStockLevel(product_id, location_id)
 *   → Sums qty_delta across all ledger_entries WHERE status = 'done'
 *     for the given product + location combination.
 *
 * Cache strategy
 * ──────────────
 * An in-process Map acts as a write-through cache:
 *   • On every postLedgerEntry() write, invalidateStockCache() is called
 *     before getStockLevel() recomputes from the DB.
 *   • The cache is NEVER updated directly — only recomputed from the ledger.
 *   • This means the cache is always a mirror of the DB, never a source of truth.
 *   • For a hackathon demo running a single process this is fine.
 *     In a multi-process/clustered setup you'd replace the Map with Redis.
 */

const { query } = require('../db/pool');

// ── In-process write-through cache ───────────────────────────────────────────

/** @type {Map<string, number>} key = `${product_id}:${location_id}` */
const stockCache = new Map();

/**
 * Build the cache key for a product/location pair.
 * @param {string} productId
 * @param {string} locationId
 * @returns {string}
 */
function cacheKey(productId, locationId) {
  return `${productId}:${locationId}`;
}

/**
 * Evict a specific product/location entry from the cache.
 * Called by postLedgerEntry() before recomputing.
 *
 * @param {string} productId
 * @param {string} locationId
 */
function invalidateStockCache(productId, locationId) {
  stockCache.delete(cacheKey(productId, locationId));
}

/**
 * Evict all cached values — useful after a bulk write or migration.
 */
function invalidateAllStockCache() {
  stockCache.clear();
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Calculate current stock for a product at a location.
 *
 * Reads from the ledger (the only source of truth) and caches the result.
 * The partial index `idx_ledger_stock_level` makes this query very fast even
 * with large ledger tables.
 *
 * @param {string}  productId   - UUID
 * @param {string}  locationId  - UUID
 * @param {import('pg').PoolClient} [client] - Optional: pass inside a transaction
 * @returns {Promise<number>}   - Current quantity (may be 0 or negative if oversold)
 */
async function getStockLevel(productId, locationId, client) {
  const key = cacheKey(productId, locationId);

  if (stockCache.has(key)) {
    return stockCache.get(key);
  }

  const sql = `
    SELECT COALESCE(SUM(qty_delta), 0)::numeric AS stock
    FROM   ledger_entries
    WHERE  product_id  = $1
      AND  location_id = $2
      AND  status      = 'done'
  `;

  const exec   = client ? (t, p) => client.query(t, p) : query;
  const result = await exec(sql, [productId, locationId]);
  const stock  = parseFloat(result.rows[0].stock);

  stockCache.set(key, stock);
  return stock;
}

/**
 * Get stock for a product across ALL locations.
 * Returns an array of { location_id, location_name, stock } objects.
 *
 * @param {string} productId
 * @returns {Promise<Array<{ location_id: string, location_name: string, stock: number }>>}
 */
async function getStockByLocation(productId) {
  const sql = `
    SELECT
      le.location_id,
      l.name  AS location_name,
      l.code  AS location_code,
      COALESCE(SUM(le.qty_delta), 0)::numeric AS stock
    FROM   ledger_entries le
    JOIN   locations l ON l.id = le.location_id
    WHERE  le.product_id = $1
      AND  le.status     = 'done'
    GROUP  BY le.location_id, l.name, l.code
    ORDER  BY l.name
  `;
  const { rows } = await query(sql, [productId]);
  return rows.map(r => ({
    location_id:   r.location_id,
    location_name: r.location_name,
    location_code: r.location_code,
    stock:         parseFloat(r.stock),
  }));
}

/**
 * Get total stock for a product across ALL locations combined.
 * Useful for the dashboard KPI "total on hand".
 *
 * @param {string} productId
 * @returns {Promise<number>}
 */
async function getTotalStock(productId) {
  const sql = `
    SELECT COALESCE(SUM(qty_delta), 0)::numeric AS stock
    FROM   ledger_entries
    WHERE  product_id = $1
      AND  status     = 'done'
  `;
  const { rows } = await query(sql, [productId]);
  return parseFloat(rows[0].stock);
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  getStockLevel,
  getStockByLocation,
  getTotalStock,
  invalidateStockCache,
  invalidateAllStockCache,
  stockCache, // exported for testing / inspection only
};
