-- =============================================================================
-- StockSense: Migration 002 — Product categories
-- =============================================================================
-- Note: products and locations tables already exist from migration 001.
-- This migration adds a categories table and links products to it.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(128) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add category FK to products (nullable — existing products have no category)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id  UUID    REFERENCES product_categories(id),
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS active       BOOLEAN NOT NULL DEFAULT true;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category
  ON products (category_id);

-- Seed categories
INSERT INTO product_categories (id, name) VALUES
  ('00000000-0000-0000-0002-000000000001', 'Raw Materials'),
  ('00000000-0000-0000-0002-000000000002', 'Finished Goods'),
  ('00000000-0000-0000-0002-000000000003', 'Consumables'),
  ('00000000-0000-0000-0002-000000000004', 'Spare Parts')
ON CONFLICT DO NOTHING;

COMMIT;
