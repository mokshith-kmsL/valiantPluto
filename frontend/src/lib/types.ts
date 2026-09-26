// Shared TypeScript types for StockSense Frontend

// ─── Ledger ──────────────────────────────────────────────────────────────────

export type LedgerEntryType = "receipt" | "delivery" | "transfer" | "adjustment";

export interface LedgerEntry {
  id: string;           // crypto.randomUUID()
  type: LedgerEntryType;
  timestamp: string;    // ISO 8601

  sku: string;
  quantity: number;

  // Receipt-specific
  supplierId?: string;
  warehouseId?: string;
  unitCost?: number;
  referenceNote?: string;
  productName?: string;

  // Delivery-specific
  customerId?: string;
  deliveryRef?: string;

  // Transfer-specific
  sourceLocationId?: string;
  destLocationId?: string;

  // Adjustment-specific
  locationId?: string;
  currentQty?: number;
  newQty?: number;
  variance?: number;
  reason?: string;
}

// ─── Delivery form step ───────────────────────────────────────────────────────

export type DeliveryStep = "pick" | "pack" | "validate";

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

export interface KpiMetric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

// ─── Catalogue entities ───────────────────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentQty: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
}

export interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
}

export interface Warehouse {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  name: string;
  warehouseId: string;
}

// ─── Chart ────────────────────────────────────────────────────────────────────

/** A single x-axis data point produced by buildChartData(). */
export interface ChartDataPoint {
  date: string;
  incoming: number;
  outgoing: number;
  [key: string]: string | number; // allows additional series keys
}

export interface ChartSeries {
  dataKey: string;
  label: string;
  type: "line" | "bar";
  color: string;
}

// ─── Dashboard filters ────────────────────────────────────────────────────────

export interface ActiveFilters {
  documentType: string; // "all" | LedgerEntryType
  status: string;       // "all" | specific status string
  warehouseId: string;  // "all" | Warehouse id
}
