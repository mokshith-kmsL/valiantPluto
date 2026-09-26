'use strict';

require('dotenv').config();

const express           = require('express');
const { isHealthy }     = require('./db/pool');
const {
  lowStockEmitter,
  LOW_STOCK_EVENT,
} = require('./ledger');
const ledgerRouter      = require('./routes/ledger');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/healthz', async (_req, res) => {
  const dbOk = await isHealthy();
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    status:   dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'unreachable',
    uptime:   process.uptime(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/ledger', ledgerRouter);

// ── Low-stock event bridge ────────────────────────────────────────────────────
// The dashboard KPI module can subscribe to this emitter directly (in-process),
// or we log it here as a fallback so it's visible during the demo.

lowStockEmitter.on(LOW_STOCK_EVENT, (payload) => {
  // Replace this with a WebSocket push, Redis pub/sub, or POST to dashboard
  // when your teammate's module is ready to consume it.
  console.warn(
    `[LOW STOCK ALERT] SKU=${payload.sku} | location=${payload.location_id} | `
    + `stock=${payload.current_stock} | threshold=${payload.reorder_threshold}`
  );
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nStockSense Ledger Engine running on http://localhost:${PORT}`);
  console.log(`  Health: GET  http://localhost:${PORT}/healthz`);
  console.log(`  Ledger: POST http://localhost:${PORT}/api/ledger/entries\n`);
});

module.exports = app; // exported for testing
