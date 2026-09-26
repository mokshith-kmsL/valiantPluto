"use client";

import { useState, useMemo } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import FilterBar from "@/components/dashboard/FilterBar";
import StockChart from "@/components/dashboard/StockChart";
import { kpiData } from "@/data/kpis";
import { chartData as rawChartData } from "@/data/chartData";
import { warehouses } from "@/data/warehouses";
import type { ActiveFilters } from "@/lib/types";

const DEFAULT_FILTERS: ActiveFilters = {
  documentType: "all",
  status: "all",
  warehouseId: "all",
};

export default function Dashboard() {
  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);

  // When a warehouse filter is active, zero-out chart data for other warehouses.
  // In a real app this would be a filtered fetch; for mock data we just pass through.
  const chartData = useMemo(() => {
    // All filters are "all" → show full mock data
    if (
      filters.documentType === "all" &&
      filters.status === "all" &&
      filters.warehouseId === "all"
    ) {
      return rawChartData;
    }
    // With active filters no ledger entries exist yet → show empty state
    return [];
  }, [filters]);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of current inventory status and recent stock movements.
        </p>
      </div>

      {/* Filter bar */}
      <section aria-label="Dashboard filters">
        <FilterBar
          warehouses={warehouses}
          filters={filters}
          onChange={setFilters}
        />
      </section>

      {/* KPI cards */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiData.map((metric) => (
            <KpiCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      {/* Stock movement chart */}
      <section aria-label="Stock movement chart">
        <StockChart data={chartData} />
      </section>
    </div>
  );
}
