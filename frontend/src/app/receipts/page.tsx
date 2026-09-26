"use client";

import { useState, useCallback } from "react";
import ReceiptForm from "@/components/forms/ReceiptForm";
import { useFetch } from "@/hooks/useFetch";
import { fetchReceipts, type ApiOperation } from "@/lib/api";
import type { LedgerEntry } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";

export default function ReceiptsPage() {
  const { data: receipts, loading, error, refetch } = useFetch<ApiOperation[]>(fetchReceipts);

  const handleFormSubmit = useCallback(
    (_entry: LedgerEntry) => refetch(),
    [refetch]
  );

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receipts</h1>
        <p className="mt-1 text-sm text-slate-500">Record incoming inventory from suppliers.</p>
      </div>

      <ReceiptForm onSubmit={handleFormSubmit} />

      {/* Live list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-700">All Receipts</h2>
          <button onClick={refetch} className="text-xs text-slate-400 hover:text-blue-600">↻ Refresh</button>
        </div>

        {loading && <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {error && <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {!loading && !error && receipts && (
          <div className="flex flex-col gap-2">
            {receipts.length === 0 && <p className="text-sm text-slate-400">No receipts yet.</p>}
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-mono text-slate-700">{r.sku}</span>
                <span className="text-emerald-600 font-semibold">+{r.quantity} units</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${r.status === "done" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{r.status}</span>
                <span className="text-slate-400 text-xs">{new Date(r.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
