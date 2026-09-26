# StockSense — Stock Ledger Engine

Core data-integrity layer for the StockSense Inventory Management System.
Every module (dashboard KPIs, receipts, deliveries, transfers, adjustments)
reads from or writes through this engine.

---

## Quick start

```bash
# 1 — clone and enter the project
cd stocksense

# 2 — start Postgres + the API server (builds image on first run)
docker-compose up

# 3 — the API is live
curl http://localhost:3000/healthz
```

That's it. Migrations run automatically on startup.

**Running without Docker:**

```bash
cp .env.example .env          # fill in DATABASE_URL
npm install
npm run migrate               # apply schema
npm run dev                   # nodemon hot-reload
```

---

## Architecture

### The single design rule

> Stock levels are **never stored**. They are always **calculated** by
> summing `qty_delta` across all `done` ledger entries for a given
> product + location.

This means there is no mutable "current_stock" field that can drift out of
sync. The ledger *is* the truth — everything else is a derived view of it.

### Component map

```
┌─────────────────────────────────────────────────────────────────┐
│  Receipt / Delivery / Transfer / Adjustment business logic       │
│  (your teammate's modules)                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ calls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/ledger/index.js  — public API surface                       │
│                                                                  │
│   postLedgerEntry()          ← ONLY write path to ledger_entries │
│   transitionEntryStatus()    ← advance status / cancel           │
│   getStockLevel()            ← derived qty for product+location  │
│   getStockByLocation()       ← breakdown across all locations    │
│   getTotalStock()            ← total across all locations        │
│   STATUS.*                   ← enum constants                    │
│   canTransition()            ← state machine check               │
│   lowStockEmitter            ← subscribe to low-stock events     │
└───────────┬──────────────────────────────────────────┬──────────┘
            │                                          │
            ▼                                          ▼
┌───────────────────────┐              ┌───────────────────────────┐
│  src/db/pool.js        │              │  src/events/              │
│                        │              │  lowStockEmitter.js       │
│  query()               │              │                           │
│  withTransaction()     │              │  checkAndEmitLowStock()   │
│  isHealthy()           │              │  EventEmitter singleton   │
└───────────────────────┘              └───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                        │
│                                                                    │
│  ledger_entries  (append-only, immutability enforced by trigger)   │
│  products        (holds reorder_threshold)                         │
│  locations                                                         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key design decisions (for judges)

### 1. Append-only ledger

`ledger_entries` has a Postgres trigger that raises an exception on any
`UPDATE` or `DELETE`. Corrections happen by inserting a new row with the
opposite `qty_delta` — the history of every mistake and its fix is
permanently visible.

### 2. SERIALIZABLE transactions

`withTransaction()` opens every write at `ISOLATION LEVEL SERIALIZABLE`.
This is stronger than the Postgres default (`READ COMMITTED`) and prevents
write-skew anomalies where two concurrent transfers could race and produce
incorrect stock totals. Postgres raises `serialization_failure` (code
`40001`) on conflict; callers can safely retry.

### 3. Atomic multi-entry writes (transfers)

`postLedgerEntry()` accepts a **single entry or an array**. An array is
committed as one transaction — either both the source debit and destination
credit land, or neither does. This is the only correct way to model an
internal transfer.

```js
// Transfer: 50 units from Main Warehouse → Dispatch Bay
await postLedgerEntry([
  { product_id, location_id: 'WH-MAIN',     qty_delta: -50, operation_type: 'transfer', ... },
  { product_id, location_id: 'WH-DISPATCH', qty_delta: +50, operation_type: 'transfer', ... },
]);
```

### 4. Status state machine

```
draft → waiting → ready → done → canceled
  └──────────────────────────────────┘
       (any state can go to canceled)
```

Only `done` entries count toward stock. Skipping steps (e.g. `draft → done`)
is rejected with a descriptive error. Canceling a `done` entry automatically
creates a reversing entry so stock stays accurate without touching the
original row.

### 5. Derived stock with write-through cache

`getStockLevel()` runs `SELECT SUM(qty_delta) … WHERE status = 'done'`
against a partial index. An in-process `Map` caches the result. The cache
is invalidated (not updated) by every `postLedgerEntry()` write and
recomputed from the DB — it can never drift independently.

### 6. Low-stock events

After every write, the engine compares the new stock level against
`products.reorder_threshold`. If `stock ≤ threshold`, a `low_stock` event
is emitted on a Node.js `EventEmitter`. The dashboard module subscribes like
this:

```js
const { lowStockEmitter, LOW_STOCK_EVENT } = require('./src/ledger');

lowStockEmitter.on(LOW_STOCK_EVENT, (payload) => {
  // payload: { product_id, location_id, sku, current_stock, reorder_threshold, triggered_at }
  // → push to dashboard KPI, send notification, etc.
});
```

---

## API reference

All routes are prefixed `/api/ledger`.

### Post ledger entries

```
POST /api/ledger/entries
Content-Type: application/json
```

**Single entry:**
```json
{
  "product_id":       "uuid",
  "location_id":      "uuid",
  "qty_delta":        100,
  "operation_type":   "receipt",
  "reference_doc_id": "uuid",
  "created_by":       "user-id"
}
```

**Batch (transfer):**
```json
[
  { "product_id": "uuid", "location_id": "src-uuid",  "qty_delta": -50, "operation_type": "transfer", "reference_doc_id": "doc-uuid", "created_by": "user-id" },
  { "product_id": "uuid", "location_id": "dest-uuid", "qty_delta":  50, "operation_type": "transfer", "reference_doc_id": "doc-uuid", "created_by": "user-id" }
]
```

**Response:**
```json
{
  "success": true,
  "entries": [
    {
      "entry_id": "uuid",
      "product_id": "uuid",
      "location_id": "uuid",
      "qty_delta": 100,
      "operation_type": "receipt",
      "status": "done",
      "new_stock_at_location": 100
    }
  ],
  "low_stock_alerts": []
}
```

---

### Get stock level (single location)

```
GET /api/ledger/stock/:productId/:locationId
```

```json
{ "product_id": "...", "location_id": "...", "stock": 75 }
```

---

### Get stock across all locations

```
GET /api/ledger/stock/:productId
```

```json
{
  "product_id": "...",
  "total_stock": 175,
  "by_location": [
    { "location_id": "...", "location_name": "Main Warehouse", "location_code": "WH-MAIN", "stock": 100 },
    { "location_id": "...", "location_name": "Dispatch Bay",   "location_code": "WH-DISPATCH", "stock": 75 }
  ]
}
```

---

### Ledger history

```
GET /api/ledger/entries/:productId                     # all locations
GET /api/ledger/entries/:productId/:locationId         # one location
```

Optional query params: `?limit=100&offset=0`

---

### Advance entry status

```
PATCH /api/ledger/entries/:entryId/status
Content-Type: application/json

{ "status": "done", "actor_id": "user-id" }
```

Canceling a `done` entry returns the original + a `reversal` entry in the
response.

---

## File structure

```
stocksense/
├── migrations/
│   └── 001_initial_schema.sql     # all DDL — tables, enums, triggers, indexes
├── scripts/
│   └── migrate.js                 # migration runner
├── src/
│   ├── db/
│   │   └── pool.js                # pg.Pool singleton, query(), withTransaction()
│   ├── events/
│   │   └── lowStockEmitter.js     # low-stock event emitter
│   ├── ledger/
│   │   ├── index.js               # public API surface (import from here)
│   │   ├── postLedgerEntry.js     # ONLY write path to ledger_entries
│   │   ├── stateMachine.js        # status transition rules
│   │   └── stockLevel.js          # getStockLevel() + cache
│   ├── routes/
│   │   └── ledger.js              # Express router
│   └── server.js                  # app entry point
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Integration guide (for your teammate)

Import everything from the ledger public API:

```js
const {
  postLedgerEntry,
  transitionEntryStatus,
  getStockLevel,
  STATUS,
  lowStockEmitter,
  LOW_STOCK_EVENT,
} = require('./src/ledger');
```

**Receipt (stock in):**
```js
await postLedgerEntry({
  product_id:       receiptLine.product_id,
  location_id:      receipt.destination_location_id,
  qty_delta:        +receiptLine.qty,
  operation_type:   'receipt',
  reference_doc_id: receipt.id,
  created_by:       currentUser.id,
});
```

**Delivery (stock out):**
```js
await postLedgerEntry({
  product_id:       line.product_id,
  location_id:      delivery.source_location_id,
  qty_delta:        -line.qty,            // negative = stock out
  operation_type:   'delivery',
  reference_doc_id: delivery.id,
  created_by:       currentUser.id,
});
```

**Transfer (atomic two-leg):**
```js
await postLedgerEntry([
  { product_id, location_id: transfer.from_location_id, qty_delta: -qty, operation_type: 'transfer', reference_doc_id: transfer.id, created_by },
  { product_id, location_id: transfer.to_location_id,   qty_delta: +qty, operation_type: 'transfer', reference_doc_id: transfer.id, created_by },
]);
```

**Adjustment (cycle count correction):**
```js
const current = await getStockLevel(productId, locationId);
const delta   = targetQty - current;   // positive or negative
await postLedgerEntry({
  product_id:       productId,
  location_id:      locationId,
  qty_delta:        delta,
  operation_type:   'adjustment',
  reference_doc_id: adjustment.id,
  created_by:       currentUser.id,
});
```

**Cancel a done entry:**
```js
await transitionEntryStatus(entryId, STATUS.CANCELED, currentUser.id);
// Original entry status → 'canceled'
// A reversing entry is automatically created and committed
```

---

## Seed data

The migration includes three locations and three products for demo use.

| Location | Code |
|---|---|
| Main Warehouse | WH-MAIN |
| Dispatch Bay | WH-DISPATCH |
| Returns Bay | WH-RETURNS |

| Product | SKU | Reorder threshold |
|---|---|---|
| Widget A | SKU-WIDGET-A | 10 |
| Widget B | SKU-WIDGET-B | 5 |
| Bulk Oil 5L | SKU-BULK-OIL | 20 |

UUIDs are in the migration file for use in cURL / Postman tests.
