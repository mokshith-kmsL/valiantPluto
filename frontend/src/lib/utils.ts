import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LedgerEntry, ActiveFilters, ChartDataPoint, DeliveryStep } from "@/lib/types";

// ─── shadcn/ui helper ─────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── ID generation ────────────────────────────────────────────────────────────

/**
 * Generates a unique ID.
 * Uses `crypto.randomUUID()` when available; falls back to a timestamp + random
 * string for environments that do not support the Web Crypto API.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Adjustment variance ──────────────────────────────────────────────────────

/**
 * Computes the stock variance for an adjustment entry.
 * Returns a positive number when stock increases, negative when it decreases.
 */
export function computeVariance(newQty: number, currentQty: number): number {
  return newQty - currentQty;
}

// ─── Delivery state machine ───────────────────────────────────────────────────

/**
 * Advances the delivery workflow one step.
 * Transitions: pick → pack → validate → done
 */
export function nextDeliveryStep(current: DeliveryStep): DeliveryStep | "done" {
  const transitions: Record<DeliveryStep, DeliveryStep | "done"> = {
    pick: "pack",
    pack: "validate",
    validate: "done",
  };
  return transitions[current];
}

// ─── Dashboard filters ────────────────────────────────────────────────────────

/**
 * Filters a ledger entry array by the active dashboard filters.
 * A filter dimension set to "all" is ignored (no filtering on that axis).
 *
 * - `documentType` maps to `entry.type`
 * - `warehouseId`  maps to `entry.warehouseId`
 * - `status`       has no counterpart on LedgerEntry — always passes through
 */
export function applyFilters(
  data: LedgerEntry[],
  filters: ActiveFilters
): LedgerEntry[] {
  return data.filter((entry) => {
    if (filters.documentType !== "all" && entry.type !== filters.documentType) {
      return false;
    }
    if (filters.warehouseId !== "all" && entry.warehouseId !== filters.warehouseId) {
      return false;
    }
    // status has no field on LedgerEntry — pass through for now
    return true;
  });
}

// ─── Chart data builder ───────────────────────────────────────────────────────

/**
 * Aggregates ledger entries into per-day chart data points.
 *
 * - Receipts contribute to `incoming` quantities.
 * - Deliveries contribute to `outgoing` quantities.
 * - Other entry types (transfers, adjustments) are ignored.
 *
 * Returns an array sorted ascending by date string (YYYY-MM-DD).
 */
export function buildChartData(entries: LedgerEntry[]): ChartDataPoint[] {
  const map = new Map<string, { incoming: number; outgoing: number }>();

  for (const entry of entries) {
    // Extract YYYY-MM-DD from the ISO 8601 timestamp
    const date = entry.timestamp.slice(0, 10);

    if (!map.has(date)) {
      map.set(date, { incoming: 0, outgoing: 0 });
    }

    const point = map.get(date)!;

    if (entry.type === "receipt") {
      point.incoming += entry.quantity;
    } else if (entry.type === "delivery") {
      point.outgoing += entry.quantity;
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { incoming, outgoing }]) => ({ date, incoming, outgoing }));
}
