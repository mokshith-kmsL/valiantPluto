'use strict';

/**
 * src/db/pool.js
 *
 * Single shared pg.Pool instance for the entire application.
 * All database access goes through this module — never create ad-hoc Pool
 * or Client instances elsewhere.
 *
 * Usage:
 *   const { query, withTransaction } = require('./pool');
 *
 *   // Simple query
 *   const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
 *
 *   // Transaction (client is automatically committed or rolled back)
 *   await withTransaction(async (client) => {
 *     await client.query('INSERT INTO ...', [...]);
 *     await client.query('INSERT INTO ...', [...]);
 *   });
 */

const { Pool } = require('pg');

// ── Pool configuration ────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Conservative pool sizing — suitable for a single-process hackathon demo.
  // For production you'd size this based on Postgres max_connections.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Surface connection errors early so the process fails fast on bad config
pool.on('error', (err) => {
  console.error('[db/pool] Unexpected pool error:', err.message);
});

// ── Simple query helper ───────────────────────────────────────────────────────

/**
 * Run a single parameterised query on a pool-managed client.
 *
 * @param {string}  text   - SQL statement
 * @param {Array}   [params] - Bound parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const ms = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.debug(`[db] query (${ms}ms) — ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
    return result;
  } catch (err) {
    console.error('[db] query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

// ── Transaction helper ────────────────────────────────────────────────────────

/**
 * Execute `fn` inside a serialisable transaction.
 * Automatically commits on success, rolls back on any thrown error.
 *
 * Use SERIALIZABLE isolation (not just READ COMMITTED) so concurrent writes
 * to the same product/location are correctly serialised — critical for
 * accurate stock calculations.
 *
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    // SERIALIZABLE catches write-skew anomalies that READ COMMITTED misses.
    // Postgres will raise serialization_failure (40001) on conflict; callers
    // should retry on that error code if needed.
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Health check ─────────────────────────────────────────────────────────────

/**
 * Verify the database is reachable. Used by the /healthz endpoint.
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { query, withTransaction, isHealthy, pool };
