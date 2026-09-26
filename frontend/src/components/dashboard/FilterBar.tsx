"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveFilters, Warehouse } from "@/lib/types";

interface FilterBarProps {
  warehouses: Warehouse[];
  filters: ActiveFilters;
  onChange: (updated: ActiveFilters) => void;
}

const DOCUMENT_TYPES = [
  { value: "all",        label: "All Types" },
  { value: "receipt",    label: "Receipt" },
  { value: "delivery",   label: "Delivery" },
  { value: "transfer",   label: "Internal Transfer" },
  { value: "adjustment", label: "Adjustment" },
];

const STATUSES = [
  { value: "all",      label: "All Statuses" },
  { value: "draft",    label: "Draft" },
  { value: "waiting",  label: "Waiting" },
  { value: "ready",    label: "Ready" },
  { value: "done",     label: "Done" },
  { value: "canceled", label: "Canceled" },
];

export default function FilterBar({ warehouses, filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Document Type
        </label>
        <Select
          value={filters.documentType}
          onValueChange={(val) => onChange({ ...filters, documentType: val })}
        >
          <SelectTrigger className="h-9 text-sm bg-white">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Status
        </label>
        <Select
          value={filters.status}
          onValueChange={(val) => onChange({ ...filters, status: val })}
        >
          <SelectTrigger className="h-9 text-sm bg-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1 min-w-[180px]">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Warehouse
        </label>
        <Select
          value={filters.warehouseId}
          onValueChange={(val) => onChange({ ...filters, warehouseId: val })}
        >
          <SelectTrigger className="h-9 text-sm bg-white">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
