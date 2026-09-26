"use client";

import { useCallback } from "react";
import TransferForm from "@/components/forms/TransferForm";
import { useFetch } from "@/hooks/useFetch";
import { fetchTransfers, type ApiOperation } from "@/lib/api";
import type { LedgerEntry } from "@/lib/types";
import { Loader2, AlertCircle } from "lucide-react";

export default function TransfersPage() {
  const { data: transfers, loading, error, refetch } = useFetch<ApiOperation[]>(fetchTransfers);

  const handleFormSubmit = useCallback(
    (_entry: LedgerEntry) => refetch(),
    [refetch]
  );

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Internal Transfers</h1>
        <p className="mt-1 text-sm text-slate-500">Move stock between warehouse locations.</p>
      </div>

      <TransferForm onSubmit={handleFormSubmit} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-700">All Transfers</h2>
          <button onClick={refetch} className="text-xs text-slate-400 hover:text-blue-600">↻ Refresh</button>
        </div>

        {loading && <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {error && <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {!loading && !error && transfers && (
          <div className="flex flex-col gap-2">
            {transfers.length === 0 && <p className="text-sm text-slate-400">No transfers yet.</p>}
            {transfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-mono text-slate-700">{t.sku}</span>
                <span className="text-blue-600 font-semibold">{t.quantity} units</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${t.status === "done" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{t.status}</span>
                <span className="text-slate-400 text-xs">{new Date(t.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
