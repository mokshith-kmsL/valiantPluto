"use client";

import { useFetch } from "@/hooks/useFetch";
import { fetchProducts, type ApiProduct } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";

export default function ProductsPage() {
  const { data: products, loading, error, refetch } = useFetch<ApiProduct[]>(fetchProducts);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">All products currently tracked in the system.</p>
        </div>
        <button onClick={refetch} className="text-xs text-slate-400 hover:text-blue-600 transition-colors">
          ↻ Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && products && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{p.sku}</p>
                  </div>
                  <Badge
                    variant={p.currentQty <= 0 ? "destructive" : p.currentQty < 10 ? "secondary" : "default"}
                    className="shrink-0"
                  >
                    {p.currentQty <= 0 ? "Out of stock" : p.currentQty < 10 ? "Low stock" : "In stock"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">{p.currentQty}</span>
                  <span className="text-sm text-slate-400">units</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{p.category}</p>
              </CardContent>
            </Card>
          ))}
          {products.length === 0 && (
            <p className="col-span-full text-sm text-slate-400">No products found.</p>
          )}
        </div>
      )}
    </div>
  );
}
