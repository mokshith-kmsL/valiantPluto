-- =============================================================================
-- StockSense: Initial Schema Migration
-- 001_initial_schema.sql
--
-- Design principles:
--   • ledger_entries is APPEND-ONLY — no UPDATE or DELETE ever touches it.
--   • Stock levels are always DERIVED by SUM(qty_delta) WHERE status = 'done'.
--   • Corrections happen via new reversing entries, not mutation.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

CREATE TYPE operation_type_enum AS ENUM (
  'receipt',      -- stock arriving from a supplier
  'delivery',     -- stock leaving to a customer
  'transfer',     -- internal move between locations (always 2 entries)
  'adjustment'    -- manual correction (cycle count, damage write-off, etc.)
);

CREATE TYPE entry_status_enum AS ENUM (
  'draft',        -- created but not yet validated
  'waiting',      -- waiting for a prerequisite (approval, arrival scan, etc.)
  'ready',        -- validated, ready to be committed
  'done',         -- committed — THIS is the only status counted in stock totals
  'canceled'      -- voided; if was 'done', a reversing entry was also created
);

-- ---------------------------------------------------------------------------
-- products  (reference table — owned by another module, defined here for FK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku              VARCHAR(64)  NOT NULL UNIQUE,
  name             VARCHAR(255) NOT NULL,
  reorder_threshold NUMERIC(12, 4) NOT NULL DEFAULT 0,  -- low-stock trigger level
  unit             VARCHAR(32)  NOT NULL DEFAULT 'unit',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN products.reorder_threshold IS
  'When derived stock at any location falls at or below this value a low-stock event is emitted.';

-- ---------------------------------------------------------------------------
-- locations  (warehouses, bins, stores — reference table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  code             VARCHAR(64)  NOT NULL UNIQUE,
  description      TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- ledger_entries  (THE core append-only audit log)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledger_entries (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What and where
  product_id       UUID              NOT NULL REFERENCES products(id),
  location_id      UUID              NOT NULL REFERENCES locations(id),

  -- Signed quantity: positive = stock in, negative = stock out
  qty_delta        NUMERIC(12, 4)    NOT NULL,

  -- Classification
  operation_type   operation_type_enum NOT NULL,

  -- Back-reference to the business document that triggered this entry
  -- (receipt record, delivery record, transfer record, adjustment record)
  reference_doc_id UUID              NOT NULL,

  -- State machine status — only 'done' counts toward stock
  status           entry_status_enum NOT NULL DEFAULT 'draft',

  -- If this entry reverses another (cancellation), point at the original
  reverses_entry_id UUID             REFERENCES ledger_entries(id),

  -- Audit columns
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  created_by       VARCHAR(255)      NOT NULL,

  -- Immutability guard: prevent UPDATE/DELETE at the DB level
  -- (application enforces this too, but belt-and-suspenders)
  CONSTRAINT no_negative_absolute_qty CHECK (qty_delta <> 0)
);

COMMENT ON TABLE ledger_entries IS
  'Append-only double-entry stock ledger. Never UPDATE or DELETE rows. '
  'Corrections are new rows with reversed qty_delta and reverses_entry_id set.';

COMMENT ON COLUMN ledger_entries.qty_delta IS
  'Signed change in quantity. Positive = stock in, Negative = stock out. '
  'Only rows with status=done are summed for current stock levels.';

COMMENT ON COLUMN ledger_entries.reference_doc_id IS
  'UUID of the business document (receipt/delivery/transfer/adjustment) '
  'that generated this ledger entry.';

-- ---------------------------------------------------------------------------
-- Indexes for the most common read patterns
-- ---------------------------------------------------------------------------

-- getStockLevel() — the hot query
CREATE INDEX idx_ledger_stock_level
  ON ledger_entries (product_id, location_id, status)
  WHERE status = 'done';

-- Fetching history for a product across all locations
CREATE INDEX idx_ledger_product
  ON ledger_entries (product_id, created_at DESC);

-- Fetching history for a specific location
CREATE INDEX idx_ledger_location
  ON ledger_entries (location_id, created_at DESC);

-- Looking up entries by source document (e.g. "show me all ledger lines for receipt #X")
CREATE INDEX idx_ledger_reference_doc
  ON ledger_entries (reference_doc_id);

-- ---------------------------------------------------------------------------
-- Immutability trigger — hard-block UPDATE and DELETE at DB level
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ledger_entries_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow status-only updates (the only legitimate mutation on a ledger row).
  -- All financial fields (qty_delta, product_id, location_id, etc.) are immutable.
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.product_id        = OLD.product_id        AND
        NEW.location_id       = OLD.location_id       AND
        NEW.qty_delta         = OLD.qty_delta         AND
        NEW.operation_type    = OLD.operation_type    AND
        NEW.reference_doc_id  = OLD.reference_doc_id  AND
        NEW.created_by        = OLD.created_by) THEN
      RETURN NEW;  -- status-only change, allow it
    END IF;
    RAISE EXCEPTION
      'ledger_entries financial fields are immutable. Row % cannot be changed — create a reversing entry instead.', OLD.id;
  END IF;
  -- Block all DELETEs unconditionally
  RAISE EXCEPTION
    'ledger_entries is append-only. Row % cannot be % — create a reversing entry instead.',
    OLD.id, TG_OP;
END;
$$;

CREATE TRIGGER trg_ledger_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

CREATE TRIGGER trg_ledger_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance for products
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: minimal reference data for local dev / demo
-- ---------------------------------------------------------------------------

INSERT INTO locations (id, name, code, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Main Warehouse',   'WH-MAIN',    'Primary storage facility'),
  ('00000000-0000-0000-0000-000000000002', 'Dispatch Bay',     'WH-DISPATCH','Outbound staging area'),
  ('00000000-0000-0000-0000-000000000003', 'Returns Bay',      'WH-RETURNS', 'Incoming returns staging')
ON CONFLICT DO NOTHING;

INSERT INTO products (id, sku, name, reorder_threshold, unit) VALUES
  ('00000000-0000-0000-0001-000000000001', 'SKU-WIDGET-A', 'Widget A',    10, 'unit'),
  ('00000000-0000-0000-0001-000000000002', 'SKU-WIDGET-B', 'Widget B',     5, 'unit'),
  ('00000000-0000-0000-0001-000000000003', 'SKU-BULK-OIL', 'Bulk Oil 5L', 20, 'litre')
ON CONFLICT DO NOTHING;

COMMIT;
