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
}

export const fetchKpis = (): Promise<KpiResponse> =>
  request<KpiResponse>("/api/dashboard/kpis");

// ─── Reference data ───────────────────────────────────────────────────────────

export interface ApiProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentQty: number;
}

export interface ApiLocation {
  id: string;
  name: string;
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

export const fetchProducts  = (): Promise<ApiProduct[]>  => request<ApiProduct[]>("/api/products");
export const fetchLocations = (): Promise<ApiLocation[]> => request<ApiLocation[]>("/api/locations");

// ─── Operations lists ─────────────────────────────────────────────────────────

export interface ApiOperation {
  id: string;
  status: string;
  sku: string;
  quantity: number;
  timestamp: string;
  [key: string]: unknown;
}

export const fetchReceipts   = (): Promise<ApiOperation[]> => request<ApiOperation[]>("/api/receipts");
export const fetchDeliveries = (): Promise<ApiOperation[]> => request<ApiOperation[]>("/api/deliveries");
export const fetchTransfers  = (): Promise<ApiOperation[]> => request<ApiOperation[]>("/api/transfers");
export const fetchAdjustments= (): Promise<ApiOperation[]> => request<ApiOperation[]>("/api/adjustments");

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

export const fetchHistory = (): Promise<ApiHistoryEntry[]> =>
  request<ApiHistoryEntry[]>("/api/history");

// ─── Create operations ────────────────────────────────────────────────────────

export const createReceipt    = (body: unknown): Promise<ApiOperation> =>
  request<ApiOperation>("/api/receipts",    { method: "POST", body: JSON.stringify(body) });

export const createDelivery   = (body: unknown): Promise<ApiOperation> =>
  request<ApiOperation>("/api/deliveries",  { method: "POST", body: JSON.stringify(body) });

export const createTransfer   = (body: unknown): Promise<ApiOperation> =>
  request<ApiOperation>("/api/transfers",   { method: "POST", body: JSON.stringify(body) });

export const createAdjustment = (body: unknown): Promise<ApiOperation> =>
  request<ApiOperation>("/api/adjustments", { method: "POST", body: JSON.stringify(body) });

// ─── Validate (commit stock move) ─────────────────────────────────────────────

export type OperationType = "receipts" | "deliveries" | "transfers" | "adjustments";

export const validateOperation = (type: OperationType, id: string): Promise<ApiOperation> =>
  request<ApiOperation>(`/api/${type}/${id}/validate`, { method: "POST" });
