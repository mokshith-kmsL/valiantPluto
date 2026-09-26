// Central API client for StockSense
// To point at a different backend, change BASE_URL only.

const BASE_URL = "http://localhost:3000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${options?.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface KpiResponse {
  totalProducts: number;
  lowStockItems: number;
  pendingReceipts: number;
  pendingDeliveries: number;
  scheduledTransfers: number;
  outOfStockCount: number;
}

// Backend returns snake_case — map to camelCase for the frontend components
export const fetchKpis = async (): Promise<KpiResponse> => {
  const data = await request<{
    success: boolean;
    kpis: {
      total_products: number;
      low_stock_count: number;
      out_of_stock_count: number;
      pending_receipts: number;
      pending_deliveries: number;
      scheduled_transfers: number;
    };
  }>("/api/dashboard/kpis");

  return {
    totalProducts:      data.kpis.total_products,
    lowStockItems:      data.kpis.low_stock_count + data.kpis.out_of_stock_count,
    pendingReceipts:    data.kpis.pending_receipts,
    pendingDeliveries:  data.kpis.pending_deliveries,
    scheduledTransfers: data.kpis.scheduled_transfers,
    outOfStockCount:    data.kpis.out_of_stock_count,
  };
};

// ─── Reference data ───────────────────────────────────────────────────────────

export interface ApiProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentQty: number;
  unit: string;
  reorder_threshold: number;
  is_low_stock: boolean;
}

export interface ApiLocation {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
}

export interface ApiSupplier {
  id: string;
  name: string;
  contactEmail?: string;
}

export interface ApiCustomer {
  id: string;
  name: string;
  contactEmail?: string;
}

// Backend returns { success, products: [...] } — unwrap the array
export const fetchProducts = async (): Promise<ApiProduct[]> => {
  const data = await request<{
    success: boolean;
    products: Array<{
      id: string;
      sku: string;
      name: string;
      category_name: string | null;
      total_stock: number;
      unit: string;
      reorder_threshold: number;
      is_low_stock: boolean;
    }>;
  }>("/api/products");

  return data.products.map(p => ({
    id:                p.id,
    sku:               p.sku,
    name:              p.name,
    category:          p.category_name ?? "Uncategorized",
    currentQty:        p.total_stock,
    unit:              p.unit,
    reorder_threshold: p.reorder_threshold,
    is_low_stock:      p.is_low_stock,
  }));
};

// Backend returns { success, locations: [...] } — unwrap the array
export const fetchLocations = async (): Promise<ApiLocation[]> => {
  const data = await request<{
    success: boolean;
    locations: Array<{
      id: string;
      name: string;
      code: string;
    }>;
  }>("/api/locations");

  return data.locations.map(l => ({
    id:          l.id,
    name:        l.name,
    code:        l.code,
    warehouseId: l.id, // locations ARE warehouses in this system
  }));
};

// ─── Operations lists ─────────────────────────────────────────────────────────

export interface ApiOperation {
  id: string;
  status: string;
  reference: string;
  sku?: string;
  quantity?: number;
  timestamp: string;
  [key: string]: unknown;
}

// Backend returns { success, receipts: [...] } — unwrap
export const fetchReceipts = async (): Promise<ApiOperation[]> => {
  const data = await request<{ success: boolean; receipts: ApiOperation[] }>("/api/receipts");
  return data.receipts.map(r => ({ ...r, timestamp: r.created_at as string }));
};

export const fetchDeliveries = async (): Promise<ApiOperation[]> => {
  const data = await request<{ success: boolean; deliveries: ApiOperation[] }>("/api/deliveries");
  return data.deliveries.map(d => ({ ...d, timestamp: d.created_at as string }));
};

export const fetchTransfers = async (): Promise<ApiOperation[]> => {
  const data = await request<{ success: boolean; transfers: ApiOperation[] }>("/api/transfers");
  return data.transfers.map(t => ({ ...t, timestamp: t.created_at as string }));
};

export const fetchAdjustments = async (): Promise<ApiOperation[]> => {
  const data = await request<{ success: boolean; adjustments: ApiOperation[] }>("/api/adjustments");
  return data.adjustments.map(a => ({ ...a, timestamp: a.created_at as string }));
};

// ─── Move history ─────────────────────────────────────────────────────────────

export interface ApiHistoryEntry {
  id: string;
  type: string;
  sku: string;
  quantity: number;
  timestamp: string;
  status: string;
  reference?: string;
}

export const fetchHistory = async (): Promise<ApiHistoryEntry[]> => {
  const data = await request<{
    success: boolean;
    moves: Array<{
      entry_id: string;
      operation_type: string;
      sku: string;
      qty_delta: number;
      created_at: string;
      status: string;
      reference_doc_id: string;
    }>;
  }>("/api/history");

  return data.moves.map(m => ({
    id:        m.entry_id,
    type:      m.operation_type,
    sku:       m.sku,
    quantity:  m.qty_delta,
    timestamp: m.created_at,
    status:    m.status,
    reference: m.reference_doc_id,
  }));
};

// ─── Create operations ────────────────────────────────────────────────────────

export const createReceipt = async (body: unknown): Promise<ApiOperation> => {
  const data = await request<{ success: boolean; receipt: ApiOperation }>("/api/receipts", { method: "POST", body: JSON.stringify(body) });
  return data.receipt;
};

export const createDelivery = async (body: unknown): Promise<ApiOperation> => {
  const data = await request<{ success: boolean; delivery: ApiOperation }>("/api/deliveries", { method: "POST", body: JSON.stringify(body) });
  return data.delivery;
};

export const createTransfer = async (body: unknown): Promise<ApiOperation> => {
  const data = await request<{ success: boolean; transfer: ApiOperation }>("/api/transfers", { method: "POST", body: JSON.stringify(body) });
  return data.transfer;
};

export const createAdjustment = async (body: unknown): Promise<ApiOperation> => {
  const data = await request<{ success: boolean; adjustment: ApiOperation }>("/api/adjustments", { method: "POST", body: JSON.stringify(body) });
  return data.adjustment;
};

// ─── Validate (commit stock move) ─────────────────────────────────────────────

export type OperationType = "receipts" | "deliveries" | "transfers" | "adjustments";

export const validateOperation = (type: OperationType, id: string): Promise<ApiOperation> =>
  request<ApiOperation>(`/api/${type}/${id}/validate`, { method: "POST" });
