'use strict';

/**
 * src/routes/products.js
 *
 * Product management API.
 * Mounted at /api/products in server.js.
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/products              List all products (with search + filter)
 *  POST   /api/products              Create a product
 *  GET    /api/products/:id          Single product + stock per location
 *  PATCH  /api/products/:id          Update product fields
 *  DELETE /api/products/:id          Soft-delete (sets active = false)
 *
 *  GET    /api/products/categories   List all categories
 *  POST   /api/products/categories   Create a category
 */

const { Router } = require('express');
const { query }  = require('../db/pool');
const { getStockByLocation, getTotalStock } = require('../ledger');

const router = Router();

const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── GET /categories  (must come before /:id to avoid route conflict) ──────────

router.get('/categories', asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, description, created_at
     FROM   product_categories
     ORDER  BY name`
  );
  res.json({ success: true, categories: rows });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, error: '`name` is required' });

  const { rows } = await query(
    `INSERT INTO product_categories (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name, description || null]
  );
  res.status(201).json({ success: true, category: rows[0] });
}));

// ── GET /  — list products ────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const { search, category_id, limit = 50, offset = 0 } = req.query;

  // Build dynamic WHERE clause
  const conditions = ['p.active = true'];
  const params     = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (category_id) {
    params.push(category_id);
    conditions.push(`p.category_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(Math.min(parseInt(limit, 10), 200));
  params.push(parseInt(offset, 10));

  const { rows } = await query(
    `SELECT
       p.id,
       p.sku,
       p.name,
       p.description,
       p.unit,
       p.reorder_threshold,
       p.category_id,
       pc.name  AS category_name,
       p.created_at,
       p.updated_at,
       -- Total stock across all locations (derived from ledger)
       COALESCE((
         SELECT SUM(le.qty_delta)
         FROM   ledger_entries le
         WHERE  le.product_id = p.id
           AND  le.status     = 'done'
       ), 0)::numeric AS total_stock
     FROM   products p
     LEFT   JOIN product_categories pc ON pc.id = p.category_id
     ${where}
     ORDER  BY p.name
     LIMIT  $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    success: true,
    count:   rows.length,
    limit:   parseInt(limit, 10),
    offset:  parseInt(offset, 10),
    products: rows.map(r => ({
      ...r,
      total_stock:       parseFloat(r.total_stock),
      is_low_stock:      parseFloat(r.total_stock) <= parseFloat(r.reorder_threshold),
      reorder_threshold: parseFloat(r.reorder_threshold),
    })),
  });
}));

// ── POST /  — create product ──────────────────────────────────────────────────

router.post('/', asyncHandler(async (req, res) => {
  const {
    sku, name, description,
    category_id, unit,
    reorder_threshold,
  } = req.body;

  if (!sku)  return res.status(400).json({ success: false, error: '`sku` is required' });
  if (!name) return res.status(400).json({ success: false, error: '`name` is required' });

  const { rows } = await query(
    `INSERT INTO products
       (sku, name, description, category_id, unit, reorder_threshold)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      sku,
      name,
      description   || null,
      category_id   || null,
      unit          || 'unit',
      reorder_threshold != null ? reorder_threshold : 0,
    ]
  );

  res.status(201).json({ success: true, product: rows[0] });
}));

// ── GET /:id  — single product + stock breakdown ──────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(
    `SELECT
       p.*,
       pc.name AS category_name
     FROM   products p
     LEFT   JOIN product_categories pc ON pc.id = p.category_id
     WHERE  p.id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, error: `Product ${id} not found` });
  }

  const product = rows[0];

  // Stock breakdown per location + total (derived from ledger)
  const [byLocation, totalStock] = await Promise.all([
    getStockByLocation(id),
    getTotalStock(id),
  ]);

  res.json({
    success: true,
    product: {
      ...product,
      reorder_threshold: parseFloat(product.reorder_threshold),
      total_stock:       totalStock,
      is_low_stock:      totalStock <= parseFloat(product.reorder_threshold),
      stock_by_location: byLocation,
    },
  });
}));

// ── PATCH /:id  — update product ──────────────────────────────────────────────

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowed = ['name', 'description', 'category_id', 'unit', 'reorder_threshold'];

  const fields  = [];
  const values  = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      values.push(req.body[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ success: false, error: 'No updatable fields provided' });
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, error: `Product ${id} not found` });
  }

  res.json({ success: true, product: rows[0] });
}));

// ── DELETE /:id  — soft delete ────────────────────────────────────────────────

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(
    `UPDATE products SET active = false WHERE id = $1 RETURNING id, name`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ success: false, error: `Product ${id} not found` });
  }

  res.json({ success: true, message: `Product "${rows[0].name}" deactivated` });
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, _req, res, _next) => {
  console.error('[routes/products] Error:', err.message);
  if (err.code === '23505') {
    return res.status(409).json({ success: false, error: 'A product with that SKU already exists' });
  }
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
