"use client";

import { useFetch } from "@/hooks/useFetch";
import { fetchHistory, type ApiHistoryEntry } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  receipt:    "bg-emerald-100 text-emerald-700",
  delivery:   "bg-red-100 text-red-700",
  transfer:   "bg-blue-100 text-blue-700",
  adjustment: "bg-amber-100 text-amber-700",
};

const STATUS_COLORS: Record<string, string> = {
  done:     "bg-emerald-50 text-emerald-600",
  canceled: "bg-red-50 text-red-500",
  waiting:  "bg-slate-100 text-slate-500",
  ready:    "bg-blue-50 text-blue-600",
  draft:    "bg-slate-50 text-slate-400",
};

export default function HistoryPage() {
  const { data: history, loading, error, refetch } = useFetch<ApiHistoryEntry[]>(fetchHistory);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Move History</h1>
          <p className="mt-1 text-sm text-slate-500">All committed stock movements across all operation types.</p>
        </div>
        <button onClick={refetch} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">
          ↻ Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && history && (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          {history.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No history records found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 font-medium text-slate-500">SKU</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Reference</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_COLORS[entry.type] ?? "bg-slate-100 text-slate-600"}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{entry.sku}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{entry.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[entry.status?.toLowerCase()] ?? "bg-slate-100 text-slate-500"}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{entry.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
