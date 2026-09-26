import type { KpiMetric } from "@/lib/types";

export const kpiData: KpiMetric[] = [
  {
    id: "total-products",
    label: "Total Products in Stock",
    value: 342,
    unit: "SKUs",
    trend: "up",
    trendValue: "+4.2%",
  },
  {
    id: "low-stock",
    label: "Low / Out of Stock Items",
    value: 7,
    unit: "items",
    trend: "down",
    trendValue: "-2",
  },
  {
    id: "pending-receipts",
    label: "Pending Receipts",
    value: 12,
    unit: "receipts",
    trend: "neutral",
    trendValue: "0",
  },
  {
    id: "pending-deliveries",
    label: "Pending Deliveries",
    value: 5,
    unit: "deliveries",
    trend: "up",
    trendValue: "+1",
  },
];
