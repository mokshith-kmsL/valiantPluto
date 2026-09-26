'use strict';

/**
 * src/ledger/postLedgerEntry.js
 *
 * THE ONLY authorised write path into ledger_entries.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  postLedgerEntry(entries)                                               │
 * │                                                                         │
 * │  entries: SingleEntry | SingleEntry[]                                   │
 * │                                                                         │
 * │  SingleEntry {                                                          │
 * │    product_id       : string (UUID)   — required                        │
 * │    location_id      : string (UUID)   — required                        │
 * │    qty_delta        : number          — required, non-zero              │
 * │    operation_type   : string          — receipt|delivery|transfer|      │
 * │                                         adjustment                      │
 * │    reference_doc_id : string (UUID)   — required                        │
 * │    created_by       : string          — required                        │
 * │    status           : string          — optional, default 'done'        │
 * │    reverses_entry_id: string (UUID)   — optional, set on reversals      │
 * │  }                                                                      │
 * │                                                                         │
 * │  Returns:                                                               │
 * │  {                                                                      │
 * │    success              : boolean                                       │
 * │    entries              : [{ entry_id, product_id, location_id,        │
 * │                               qty_delta, new_stock_at_location }]      │
 * │    low_stock_alerts     : [{ product_id, location_id, ... }]           │
 * │  }                                                                      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Atomicity guarantee
 * ───────────────────
 * All entries in a single call are written inside ONE SERIALIZABLE transaction.
 * If any insert fails, ALL are rolled back — critical for transfers (two entries
 * that must both succeed or both fail).
 *
 * Status semantics
 * ────────────────
 * Only entries with status='done' count toward stock totals.
 * The default status is 'done' so callers can post-and-commit in one call.
 * Pass status:'draft'/'waiting'/'ready' to stage an entry without affecting stock.
 *
 * Cancellation / reversal
 * ───────────────────────
 * To cancel a 'done' entry, call transitionEntryStatus(entryId, 'canceled').
 * That function calls postLedgerEntry() internally to create the reversing entry.
 * Direct callers should NOT manually create reversals — use transitionEntryStatus().
 */

const { withTransaction }       = require('../db/pool');
const { STATUS }                = require('./stateMachine');
const { invalidateStockCache,
        getStockLevel }         = require('./stockLevel');
const { checkAndEmitLowStock }  = require('../events/lowStockEmitter');

// ── Valid enum values (mirrors the DB enum — keep in sync with migration) ─────

const VALID_OPERATION_TYPES = new Set(['receipt', 'delivery', 'transfer', 'adjustment']);
const VALID_STATUSES        = new Set(Object.values(STATUS));

// ── Input validation ──────────────────────────────────────────────────────────

/**
 * Validate a single entry object before it touches the database.
 * Returns an array of error strings (empty = valid).
 *
 * @param {object} entry
 * @param {number} index - Position in the batch (for error messages)
 * @returns {string[]}
 */
function validateEntry(entry, index = 0) {
  const prefix = `entries[${index}]`;
  const errors = [];

  if (!entry.product_id || typeof entry.product_id !== 'string') {
    errors.push(`${prefix}.product_id is required (UUID string)`);
  }
  if (!entry.location_id || typeof entry.location_id !== 'string') {
    errors.push(`${prefix}.location_id is required (UUID string)`);
  }
  if (entry.qty_delta === undefined || entry.qty_delta === null) {
    errors.push(`${prefix}.qty_delta is required`);
  } else if (typeof entry.qty_delta !== 'number' || isNaN(entry.qty_delta)) {
    errors.push(`${prefix}.qty_delta must be a number`);
  } else if (entry.qty_delta === 0) {
    errors.push(`${prefix}.qty_delta must be non-zero`);
  }
  if (!entry.operation_type) {
    errors.push(`${prefix}.operation_type is required`);
  } else if (!VALID_OPERATION_TYPES.has(entry.operation_type)) {
    errors.push(
      `${prefix}.operation_type "${entry.operation_type}" is not valid. `
      + `Must be one of: ${[...VALID_OPERATION_TYPES].join(', ')}`
    );
  }
  if (!entry.reference_doc_id || typeof entry.reference_doc_id !== 'string') {
    errors.push(`${prefix}.reference_doc_id is required (UUID string)`);
  }
  if (!entry.created_by || typeof entry.created_by !== 'string') {
    errors.push(`${prefix}.created_by is required`);
  }
  if (entry.status !== undefined && !VALID_STATUSES.has(entry.status)) {
    errors.push(
      `${prefix}.status "${entry.status}" is not valid. `
      + `Must be one of: ${[...VALID_STATUSES].join(', ')}`
    );
  }

  return errors;
}

// ── Core insert (runs inside the caller's transaction) ────────────────────────

/**
 * Insert a single validated entry into ledger_entries within an active client.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} entry
 * @returns {Promise<object>} The inserted row
 */
async function insertEntry(client, entry) {
  const sql = `
    INSERT INTO ledger_entries (
      product_id,
      location_id,
      qty_delta,
      operation_type,
      reference_doc_id,
      status,
      reverses_entry_id,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      product_id,
      location_id,
      qty_delta,
      operation_type,
      reference_doc_id,
      status,
      reverses_entry_id,
      created_at,
      created_by
  `;

  const params = [
    entry.product_id,
    entry.location_id,
    entry.qty_delta,
    entry.operation_type,
    entry.reference_doc_id,
    entry.status || STATUS.DONE,   // default to done so stock is immediately reflected
    entry.reverses_entry_id || null,
    entry.created_by,
  ];

  const result = await client.query(sql, params);
  return result.rows[0];
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Post one or more ledger entries as a single atomic transaction.
 *
 * This is the ONLY function in the codebase that writes to ledger_entries.
 *
 * @param {object | object[]} entries - A single entry object or array of entries
 * @returns {Promise<{
 *   success: boolean,
 *   entries: Array<{
 *     entry_id: string,
 *     product_id: string,
 *     location_id: string,
 *     qty_delta: number,
 *     status: string,
 *     new_stock_at_location: number
 *   }>,
 *   low_stock_alerts: Array<object>
 * }>}
 */
async function postLedgerEntry(entries) {
  // ── 1. Normalise to array ───────────────────────────────────────────────────
  const batch = Array.isArray(entries) ? entries : [entries];

  if (batch.length === 0) {
    throw Object.assign(new Error('postLedgerEntry: entries array cannot be empty'), {
      code: 'EMPTY_BATCH',
    });
  }

  // ── 2. Validate all entries BEFORE opening a transaction ───────────────────
  //    Fail fast on bad input without touching the DB.
  const allErrors = batch.flatMap((entry, i) => validateEntry(entry, i));
  if (allErrors.length > 0) {
    const err = new Error('postLedgerEntry validation failed:\n' + allErrors.join('\n'));
    err.code   = 'VALIDATION_ERROR';
    err.errors = allErrors;
    throw err;
  }

  // ── 3. Execute inside a single SERIALIZABLE transaction ───────────────────
  //    All inserts succeed together or all roll back together.
  const result = await withTransaction(async (client) => {
    const insertedRows = [];

    for (const entry of batch) {
      const row = await insertEntry(client, entry);
      insertedRows.push(row);
    }

    // ── 4. Recompute stock for every affected product/location ──────────────
    //    We do this inside the transaction so the returned stock level is
    //    consistent with what was just written (no TOCTOU gap).
    //
    //    Deduplicate: a transfer writes two entries for different locations;
    //    we want one stock query per unique (product_id, location_id) pair.
    const uniquePairs = [
      ...new Map(
        insertedRows.map(r => [`${r.product_id}:${r.location_id}`, r])
      ).values(),
    ];

    const stockResults = [];
    for (const row of uniquePairs) {
      // Invalidate cache first so getStockLevel() re-reads from DB
      invalidateStockCache(row.product_id, row.location_id);
      const newStock = await getStockLevel(row.product_id, row.location_id, client);
      stockResults.push({ row, newStock });
    }

    // ── 5. Build the per-entry response (each entry gets its location's stock)
    const enrichedEntries = insertedRows.map(row => ({
      entry_id:              row.id,
      product_id:            row.product_id,
      location_id:           row.location_id,
      qty_delta:             parseFloat(row.qty_delta),
      operation_type:        row.operation_type,
      reference_doc_id:      row.reference_doc_id,
      status:                row.status,
      reverses_entry_id:     row.reverses_entry_id,
      created_at:            row.created_at,
      created_by:            row.created_by,
      new_stock_at_location: stockResults.find(
        s => s.row.product_id  === row.product_id
          && s.row.location_id === row.location_id
      )?.newStock ?? null,
    }));

    // ── 6. Low-stock checks (runs inside transaction so product record is locked)
    const lowStockAlerts = [];
    for (const { row, newStock } of stockResults) {
      // Only check after 'done' entries — non-done entries don't change stock
      const entryStatus = batch.find(
        e => e.product_id === row.product_id && e.location_id === row.location_id
      )?.status || STATUS.DONE;

      if (entryStatus === STATUS.DONE) {
        const alert = await checkAndEmitLowStock(
          row.product_id,
          row.location_id,
          newStock,
          client
        );
        if (alert.triggered) {
          lowStockAlerts.push(alert.payload);
        }
      }
    }

    return { entries: enrichedEntries, low_stock_alerts: lowStockAlerts };
  });

  return { success: true, ...result };
}

// ── Status transition helper ──────────────────────────────────────────────────

/**
 * Advance an existing ledger entry to a new status.
 *
 * Enforces the state machine. If transitioning a 'done' entry to 'canceled',
 * automatically creates a reversing ledger entry (opposite qty_delta) so stock
 * totals remain accurate without mutating the original row.
 *
 * @param {string} entryId   - UUID of the ledger entry to transition
 * @param {string} newStatus - Target status (from STATUS constants)
 * @param {string} actorId   - Who is performing the transition (for audit)
 * @returns {Promise<{
 *   success: boolean,
 *   entry: object,
 *   reversal?: object
 * }>}
 */
async function transitionEntryStatus(entryId, newStatus, actorId) {
  const { assertTransition, requiresReversal } = require('./stateMachine');
  const { query }                              = require('../db/pool');

  // Fetch the current entry outside the transaction (read-only, no contention)
  const { rows } = await query(
    'SELECT * FROM ledger_entries WHERE id = $1',
    [entryId]
  );

  if (rows.length === 0) {
    const err = new Error(`Ledger entry ${entryId} not found`);
    err.code  = 'ENTRY_NOT_FOUND';
    throw err;
  }

  const current = rows[0];

  // Validate the transition before opening any transaction
  assertTransition(current.status, newStatus);

  const needsReversal = requiresReversal(current.status, newStatus);

  // Everything below runs in ONE transaction — no nesting.
  // If a reversal is needed we insert it directly via insertEntry()
  // (the internal helper) rather than calling postLedgerEntry() which
  // would try to open a second transaction and cause a serialization conflict.
  return await withTransaction(async (client) => {

    // 1. Update the status column (the only permitted mutation on a ledger row)
    await client.query(
      'UPDATE ledger_entries SET status = $1 WHERE id = $2',
      [newStatus, entryId]
    );

    let reversal     = null;
    let newStock     = null;
    let lowStockInfo = null;

    if (needsReversal) {
      // 2a. Insert the reversing entry directly using the internal helper
      //     so we stay inside this single transaction.
      const reversalRow = await insertEntry(client, {
        product_id:        current.product_id,
        location_id:       current.location_id,
        qty_delta:         -parseFloat(current.qty_delta),
        operation_type:    current.operation_type,
        reference_doc_id:  current.reference_doc_id,
        created_by:        actorId || 'system',
        status:            STATUS.DONE,
        reverses_entry_id: current.id,
      });

      // 3. Recompute stock inside this transaction
      invalidateStockCache(current.product_id, current.location_id);
      newStock = await getStockLevel(current.product_id, current.location_id, client);

      // 4. Low-stock check
      lowStockInfo = await checkAndEmitLowStock(
        current.product_id, current.location_id, newStock, client
      );

      reversal = {
        entry_id:              reversalRow.id,
        product_id:            reversalRow.product_id,
        location_id:           reversalRow.location_id,
        qty_delta:             parseFloat(reversalRow.qty_delta),
        operation_type:        reversalRow.operation_type,
        reference_doc_id:      reversalRow.reference_doc_id,
        status:                reversalRow.status,
        reverses_entry_id:     reversalRow.reverses_entry_id,
        created_at:            reversalRow.created_at,
        created_by:            reversalRow.created_by,
        new_stock_at_location: newStock,
      };
    } else {
      // 2b. Non-reversal transition — just invalidate the cache
      invalidateStockCache(current.product_id, current.location_id);
    }

    // 5. Return the updated original entry
    const updatedRow = await client.query(
      'SELECT * FROM ledger_entries WHERE id = $1',
      [entryId]
    );

    return {
      success: true,
      entry:   updatedRow.rows[0],
      ...(reversal              ? { reversal }                           : {}),
      ...(newStock !== null     ? { new_stock_at_location: newStock }    : {}),
      ...(lowStockInfo?.triggered ? { low_stock_alert: lowStockInfo.payload } : {}),
    };
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  postLedgerEntry,
  transitionEntryStatus,
  // Exported for testing
  _validateEntry: validateEntry,
};
