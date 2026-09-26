'use strict';

require('dotenv').config();

const express           = require('express');
const { isHealthy }     = require('./db/pool');
const {
  lowStockEmitter,
  LOW_STOCK_EVENT,
} = require('./ledger');
const ledgerRouter      = require('./routes/ledger');
const productsRouter    = require('./routes/products');
const locationsRouter   = require('./routes/locations');
const historyRouter     = require('./routes/history');
const dashboardRouter   = require('./routes/dashboard');
const receiptsRouter    = require('./routes/receipts');
const deliveriesRouter  = require('./routes/deliveries');
const transfersRouter   = require('./routes/transfers');
const adjustmentsRouter = require('./routes/adjustments');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow requests from the frontend dev server on any common port

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .concat([
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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

app.use('/api/ledger',      ledgerRouter);
app.use('/api/products',   productsRouter);
app.use('/api/locations',  locationsRouter);
app.use('/api/history',    historyRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/receipts',   receiptsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/transfers',  transfersRouter);
app.use('/api/adjustments',adjustmentsRouter);

// ── Low-stock event bridge ────────────────────────────────────────────────────

lowStockEmitter.on(LOW_STOCK_EVENT, (payload) => {
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
  console.log(`\nStockSense API running on http://localhost:${PORT}`);
  console.log(`  Health:    GET  http://localhost:${PORT}/healthz`);
  console.log(`  Dashboard: GET  http://localhost:${PORT}/api/dashboard/kpis`);
  console.log(`  Products:  GET  http://localhost:${PORT}/api/products`);
  console.log(`  Locations: GET  http://localhost:${PORT}/api/locations`);
  console.log(`  History:   GET  http://localhost:${PORT}/api/history`);
  console.log(`  Ledger:    POST http://localhost:${PORT}/api/ledger/entries\n`);
});

module.exports = app;
