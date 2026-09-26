'use strict';

/**
 * src/ledger/stateMachine.js
 *
 * Reusable status state machine for ledger entries.
 *
 * Valid lifecycle:
 *
 *   draft ──→ waiting ──→ ready ──→ done
 *     │           │          │       │
 *     └───────────┴──────────┴───────┴──→ canceled
 *
 * Rules enforced here:
 *  • Only the transitions listed in ALLOWED_TRANSITIONS are permitted.
 *  • Skipping steps (e.g. draft → done) is rejected.
 *  • Canceling a 'done' entry requires a reversing ledger entry — this module
 *    validates the transition; postLedgerEntry() handles the reversal write.
 *  • 'canceled' is a terminal state — nothing transitions out of it.
 */

// ── Allowed transitions ───────────────────────────────────────────────────────

/**
 * Map of: currentStatus → Set of statuses it may transition TO.
 *
 * Every valid forward path plus the cancel escape hatch.
 */
const ALLOWED_TRANSITIONS = {
  draft:    new Set(['waiting', 'canceled']),
  waiting:  new Set(['ready',   'canceled']),
  ready:    new Set(['done',    'canceled']),
  done:     new Set(['canceled']),   // canceling a done entry triggers a reversal
  canceled: new Set(),               // terminal — no exits
};

// ── Public status constants (avoids magic strings in callers) ─────────────────

const STATUS = Object.freeze({
  DRAFT:    'draft',
  WAITING:  'waiting',
  READY:    'ready',
  DONE:     'done',
  CANCELED: 'canceled',
});

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Check whether a status transition is legal.
 *
 * @param {string} from  - Current status
 * @param {string} to    - Desired next status
 * @returns {{ valid: boolean, reason?: string }}
 */
function canTransition(from, to) {
  if (!ALLOWED_TRANSITIONS[from]) {
    return { valid: false, reason: `Unknown current status: "${from}"` };
  }
  if (!ALLOWED_TRANSITIONS[to] && to !== STATUS.CANCELED) {
    return { valid: false, reason: `Unknown target status: "${to}"` };
  }
  if (!ALLOWED_TRANSITIONS[from].has(to)) {
    return {
      valid: false,
      reason: `Invalid transition: "${from}" → "${to}". `
            + `Allowed next states from "${from}": `
            + ([...ALLOWED_TRANSITIONS[from]].join(', ') || 'none (terminal state)'),
    };
  }
  return { valid: true };
}

/**
 * Assert a transition is valid; throw a descriptive error if not.
 * Use this inside business logic that wants to fail fast.
 *
 * @param {string} from
 * @param {string} to
 * @throws {Error}
 */
function assertTransition(from, to) {
  const { valid, reason } = canTransition(from, to);
  if (!valid) {
    const err = new Error(reason);
    err.code = 'INVALID_STATUS_TRANSITION';
    err.currentStatus = from;
    err.targetStatus  = to;
    throw err;
  }
}

/**
 * Returns true when transitioning to 'canceled' from 'done'.
 * In this case the caller (postLedgerEntry) must write a reversing entry.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function requiresReversal(from, to) {
  return from === STATUS.DONE && to === STATUS.CANCELED;
}

/**
 * Returns true if this status counts toward stock totals.
 * Only 'done' entries are included in SUM(qty_delta).
 *
 * @param {string} status
 * @returns {boolean}
 */
function countsAsStock(status) {
  return status === STATUS.DONE;
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  STATUS,
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
  requiresReversal,
  countsAsStock,
};
