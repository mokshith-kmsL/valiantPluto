"use client";

import { useState, useMemo } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import FilterBar from "@/components/dashboard/FilterBar";
import StockChart from "@/components/dashboard/StockChart";
import { fetchKpis } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { warehouses } from "@/data/warehouses"; // warehouse list stays static (no dedicated endpoint)
import { chartData as mockChartData } from "@/data/chartData"; // chart data fallback until a /api/chart endpoint exists
import type { ActiveFilters, KpiMetric } from "@/lib/types";
import type { KpiResponse } from "@/lib/api";

const DEFAULT_FILTERS: ActiveFilters = {
  documentType: "all",
  status: "all",
  warehouseId: "all",
};

/** Map the API response shape → KpiMetric[] the KpiCard component expects */
function mapKpis(data: KpiResponse): KpiMetric[] {
  return [
    {
      id: "total-products",
      label: "Total Products in Stock",
      value: data.totalProducts,
      unit: "SKUs",
      trend: "up",
    },
    {
      id: "low-stock",
      label: "Low / Out of Stock Items",
      value: data.lowStockItems,
      unit: "items",
      trend: data.lowStockItems > 10 ? "down" : "neutral",
    },
    {
      id: "pending-receipts",
      label: "Pending Receipts",
      value: data.pendingReceipts,
      unit: "receipts",
      trend: "neutral",
    },
    {
      id: "pending-deliveries",
      label: "Pending Deliveries",
      value: data.pendingDeliveries,
      unit: "deliveries",
      trend: "neutral",
    },
  ];
}

export default function Dashboard() {
  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);

  const { data: kpiRaw, loading, error, refetch } = useFetch(fetchKpis);

  const kpis: KpiMetric[] = useMemo(
    () => (kpiRaw ? mapKpis(kpiRaw) : []),
    [kpiRaw]
  );

  // Placeholder KPI cards shown while loading
  const placeholderKpis: KpiMetric[] = [
    { id: "total-products",    label: "Total Products in Stock", value: "—" },
    { id: "low-stock",         label: "Low / Out of Stock Items", value: "—" },
    { id: "pending-receipts",  label: "Pending Receipts",         value: "—" },
    { id: "pending-deliveries",label: "Pending Deliveries",       value: "—" },
  ];

  const displayKpis = loading || error ? placeholderKpis : kpis;

  // Chart data: use mock until a dedicated /api/chart endpoint is added
  const chartData = useMemo(() => {
    if (
      filters.documentType === "all" &&
      filters.status === "all" &&
      filters.warehouseId === "all"
    ) {
      return mockChartData;
    }
    return [];
  }, [filters]);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of current inventory status and recent stock movements.
          </p>
        </div>
        <button
          onClick={refetch}
          className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
          aria-label="Refresh dashboard"
        >
          ↻ Refresh
        </button>
      </div>

      {/* API error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Could not load KPI data: {error}
        </div>
      )}

      {/* Filter bar */}
      <section aria-label="Dashboard filters">
        <FilterBar warehouses={warehouses} filters={filters} onChange={setFilters} />
      </section>

      {/* KPI cards */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {displayKpis.map((metric) => (
            <KpiCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      {/* Chart */}
      <section aria-label="Stock movement chart">
        <StockChart data={chartData} />
      </section>
    </div>
  );
}
