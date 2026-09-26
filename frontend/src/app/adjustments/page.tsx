"use client";

import { useCallback } from "react";
import AdjustmentForm from "@/components/forms/AdjustmentForm";
import { useFetch } from "@/hooks/useFetch";
import { fetchAdjustments, type ApiOperation } from "@/lib/api";
import type { LedgerEntry } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";

export default function AdjustmentsPage() {
  const { data: adjustments, loading, error, refetch } =
    useFetch<ApiOperation[]>(fetchAdjustments);

  const handleFormSubmit = useCallback(
    (_entry: LedgerEntry) => refetch(),
    [refetch]
  );

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Adjustments</h1>
        <p className="mt-1 text-sm text-slate-500">Reconcile physical counts with system quantities.</p>
      </div>

      <AdjustmentForm onSubmit={handleFormSubmit} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-700">All Adjustments</h2>
          <button onClick={refetch} className="text-xs text-slate-400 hover:text-blue-600">↻ Refresh</button>
        </div>

        {loading && <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {error && <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {!loading && !error && adjustments && (
          <div className="flex flex-col gap-2">
            {adjustments.length === 0 && <p className="text-sm text-slate-400">No adjustments yet.</p>}
            {adjustments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-mono text-slate-700">{a.sku}</span>
                <span className="text-amber-600 font-semibold">{a.quantity} units adjusted</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${a.status === "done" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{a.status}</span>
                <span className="text-slate-400 text-xs">{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
