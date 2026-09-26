-- =============================================================================
-- StockSense: Migration 003 — Operations tables
-- receipts, deliveries, transfers, adjustments
--
-- Each table is a "business document" — the human-readable record of what
-- happened. The financial impact lives in ledger_entries via reference_doc_id.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- suppliers  (referenced by receipts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  contact    VARCHAR(255),
  email      VARCHAR(255),
  phone      VARCHAR(64),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO suppliers (id, name) VALUES
  ('00000000-0000-0000-0003-000000000001', 'Default Supplier')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- receipts  (incoming goods from suppliers)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS receipts (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             VARCHAR(64)       NOT NULL UNIQUE, -- human-readable ref e.g. REC-001
  supplier_id           UUID              REFERENCES suppliers(id),
  destination_location_id UUID            NOT NULL REFERENCES locations(id),
  status                entry_status_enum NOT NULL DEFAULT 'draft',
  notes                 TEXT,
  expected_date         DATE,
  created_by            VARCHAR(255)      NOT NULL,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id  UUID             NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id  UUID             NOT NULL REFERENCES products(id),
  qty         NUMERIC(12, 4)   NOT NULL CHECK (qty > 0),
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON receipt_lines(receipt_id);

-- ---------------------------------------------------------------------------
-- deliveries  (outgoing goods to customers)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deliveries (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           VARCHAR(64)       NOT NULL UNIQUE,
  source_location_id  UUID              NOT NULL REFERENCES locations(id),
  customer_name       VARCHAR(255),
  status              entry_status_enum NOT NULL DEFAULT 'draft',
  notes               TEXT,
  scheduled_date      DATE,
  created_by          VARCHAR(255)      NOT NULL,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  UUID           NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id   UUID           NOT NULL REFERENCES products(id),
  qty          NUMERIC(12, 4) NOT NULL CHECK (qty > 0),
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery ON delivery_lines(delivery_id);

-- ---------------------------------------------------------------------------
-- transfers  (internal stock movements between locations)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transfers (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           VARCHAR(64)       NOT NULL UNIQUE,
  from_location_id    UUID              NOT NULL REFERENCES locations(id),
  to_location_id      UUID              NOT NULL REFERENCES locations(id),
  product_id          UUID              NOT NULL REFERENCES products(id),
  qty                 NUMERIC(12, 4)    NOT NULL CHECK (qty > 0),
  status              entry_status_enum NOT NULL DEFAULT 'draft',
  notes               TEXT,
  scheduled_date      DATE,
  created_by          VARCHAR(255)      NOT NULL,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT different_locations CHECK (from_location_id <> to_location_id)
);

-- ---------------------------------------------------------------------------
-- adjustments  (cycle count corrections / write-offs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS adjustments (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   VARCHAR(64)       NOT NULL UNIQUE,
  product_id  UUID              NOT NULL REFERENCES products(id),
  location_id UUID              NOT NULL REFERENCES locations(id),
  target_qty  NUMERIC(12, 4)    NOT NULL CHECK (target_qty >= 0),
  qty_delta   NUMERIC(12, 4),   -- computed at validation time
  reason      TEXT,
  status      entry_status_enum NOT NULL DEFAULT 'draft',
  created_by  VARCHAR(255)      NOT NULL,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers for all operation tables
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_adjustments_updated_at
  BEFORE UPDATE ON adjustments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Reference number sequence helper
-- Generates refs like REC-0001, DEL-0001, TRF-0001, ADJ-0001
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS receipt_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS delivery_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS transfer_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS adjustment_seq START 1;

COMMIT;
