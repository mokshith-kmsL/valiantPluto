"use client";

import { useState } from "react";
import DeliveryForm from "@/components/forms/DeliveryForm";
import type { LedgerEntry } from "@/lib/types";

export default function DeliveriesPage() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const handleSubmit = (entry: LedgerEntry) => {
    setLedger((prev) => [entry, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Delivery Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Process outgoing inventory through pick, pack, and validate.
        </p>
      </div>

      <DeliveryForm onSubmit={handleSubmit} />

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
                <span className="text-red-500 font-semibold">−{e.quantity} units</span>
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
