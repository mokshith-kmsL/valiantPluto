"use client";

import { useState } from "react";
import AdjustmentForm from "@/components/forms/AdjustmentForm";
import type { LedgerEntry } from "@/lib/types";

export default function AdjustmentsPage() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const handleSubmit = (entry: LedgerEntry) => {
    setLedger((prev) => [entry, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Adjustments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reconcile physical counts with system quantities.
        </p>
      </div>

      <AdjustmentForm onSubmit={handleSubmit} />

      {ledger.length > 0 && (
        <section className="mt-2">
          <h2 className="text-base font-semibold text-slate-700 mb-3">
            Session Ledger ({ledger.length})
          </h2>
          <div className="flex flex-col gap-2">
            {ledger.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">{e.sku}</span>
                <span
                  className={`font-semibold ${
                    (e.variance ?? 0) > 0
                      ? "text-emerald-600"
                      : (e.variance ?? 0) < 0
                      ? "text-red-500"
                      : "text-slate-500"
                  }`}
                >
                  {(e.variance ?? 0) >= 0 ? "+" : ""}
                  {e.variance ?? 0} units
                </span>
                <span className="text-slate-400 text-xs">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
