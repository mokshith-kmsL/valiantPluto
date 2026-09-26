"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { AdjustmentSchema, type AdjustmentFormValues } from "@/lib/schemas/adjustment.schema";
import { useFetch } from "@/hooks/useFetch";
import {
  fetchProducts,
  fetchLocations,
  createAdjustment,
  validateOperation,
  type ApiProduct,
  type ApiLocation,
} from "@/lib/api";
import { computeVariance } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdjustmentFormProps {
  onSubmit?: (entry: LedgerEntry) => void;
}

interface SuccessState { variance: number; sku: string; }

export default function AdjustmentForm({ onSubmit }: AdjustmentFormProps) {
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [systemQty, setSystemQty] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: apiProducts, loading: productsLoading, error: productsError } =
    useFetch<ApiProduct[]>(fetchProducts);
  const { data: apiLocations, loading: locationsLoading, error: locationsError } =
    useFetch<ApiLocation[]>(fetchLocations);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(AdjustmentSchema),
    defaultValues: { systemQty: 0 },
  });

  // When product is selected, auto-fill SKU and set system qty from API data
  useEffect(() => {
    if (selectedProductId && apiProducts) {
      const product = apiProducts.find((p) => p.id === selectedProductId);
      if (product) {
        setValue("sku", product.sku, { shouldValidate: true });
        // currentQty from the API is the system-recorded quantity
        setSystemQty(product.currentQty ?? 0);
        setValue("systemQty", product.currentQty ?? 0);
      }
    }
  }, [selectedProductId, apiProducts, setValue]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setValue("productId", productId, { shouldValidate: true });
  };

  const handleLocationChange = (locationId: string) => {
    setSelectedLocationId(locationId);
    setValue("locationId", locationId, { shouldValidate: true });
  };

  const processSubmit = async (data: AdjustmentFormValues) => {
    setSubmitError(null);
    try {
      const variance = computeVariance(data.physicalQty, data.systemQty);

      const created = await createAdjustment({
        product_id:  data.productId,
        location_id: data.locationId,
        target_qty:  data.physicalQty,
        reason:      `Physical count adjustment. System qty: ${data.systemQty}`,
        created_by:  "user",
      });

      await validateOperation("adjustments", created.id);

      const localEntry: LedgerEntry = {
        id: created.id,
        type: "adjustment",
        timestamp: created.timestamp ?? new Date().toISOString(),
        sku: data.sku,
        quantity: Math.abs(variance),
        locationId: data.locationId,
        currentQty: data.systemQty,
        newQty: data.physicalQty,
        variance,
      };
      onSubmit?.(localEntry);
      setSuccessState({ variance, sku: data.sku });
      reset();
      setSelectedProductId("");
      setSelectedLocationId("");
      setSystemQty(null);
      setTimeout(() => setSuccessState(null), 5000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const formatVariance = (v: number) =>
    v === 0 ? "No change (0 units)" : v > 0 ? `+${v} units` : `${v} units`;

  const apiError = productsError || locationsError;

  return (
    <Card className="max-w-xl w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">Stock Adjustment</CardTitle>
      </CardHeader>
      <CardContent>
        {successState && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Adjustment validated for {successState.sku}.</p>
              <p>Variance: <span className={`font-bold ${successState.variance > 0 ? "text-emerald-600" : successState.variance < 0 ? "text-red-500" : "text-slate-500"}`}>{formatVariance(successState.variance)}</span></p>
            </div>
          </div>
        )}
        {submitError && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />{submitError}
          </div>
        )}
        {apiError && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Could not load reference data: {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(processSubmit)} noValidate className="flex flex-col gap-5">
          {/* Product */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productId">Product <span className="text-red-500">*</span></Label>
            <Select onValueChange={handleProductChange} disabled={productsLoading}>
              <SelectTrigger id="productId" className={errors.productId ? "border-red-500" : ""}>
                <SelectValue placeholder={productsLoading ? "Loading…" : "Select a product…"} />
              </SelectTrigger>
              <SelectContent>
                {(apiProducts ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.sku}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId && <p className="text-sm text-red-500">{errors.productId.message}</p>}
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locationId">Location <span className="text-red-500">*</span></Label>
            <Select onValueChange={handleLocationChange} disabled={locationsLoading}>
              <SelectTrigger id="locationId" className={errors.locationId ? "border-red-500" : ""}>
                <SelectValue placeholder={locationsLoading ? "Loading…" : "Select a location…"} />
              </SelectTrigger>
              <SelectContent>
                {(apiLocations ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.locationId && <p className="text-sm text-red-500">{errors.locationId.message}</p>}
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">SKU <span className="text-red-500">*</span></Label>
            <Input id="sku" placeholder="Auto-filled when product is selected" {...register("sku")} className={errors.sku ? "border-red-500" : "bg-slate-50"} readOnly={!!selectedProductId} />
            {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
          </div>

          {/* System Qty display */}
          {systemQty !== null && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">System Recorded Quantity: </span>
              <span className="font-semibold text-slate-800">{systemQty} units</span>
            </div>
          )}

          {/* Physical Qty */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="physicalQty">Physical Counted Quantity <span className="text-red-500">*</span></Label>
            <Input id="physicalQty" type="number" min={0} placeholder="Enter counted quantity" {...register("physicalQty", { valueAsNumber: true })} className={errors.physicalQty ? "border-red-500" : ""} />
            {errors.physicalQty && <p className="text-sm text-red-500">{errors.physicalQty.message}</p>}
            <p className="text-xs text-slate-400">The system will calculate the variance automatically.</p>
          </div>

          <Button type="submit" disabled={isSubmitting} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : "Record Adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
