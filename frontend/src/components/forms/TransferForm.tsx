"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { TransferSchema, type TransferFormValues } from "@/lib/schemas/transfer.schema";
import { useFetch } from "@/hooks/useFetch";
import {
  fetchProducts,
  fetchLocations,
  createTransfer,
  validateOperation,
  type ApiProduct,
  type ApiLocation,
} from "@/lib/api";
import { generateId } from "@/lib/utils";
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

interface TransferFormProps {
  onSubmit?: (entry: LedgerEntry) => void;
}

export default function TransferForm({ onSubmit }: TransferFormProps) {
  const [success, setSuccess] = useState(false);
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
  } = useForm<TransferFormValues>({
    resolver: zodResolver(TransferSchema),
  });

  const handleProductChange = (productId: string) => {
    setValue("productId", productId, { shouldValidate: true });
    const product = apiProducts?.find((p) => p.id === productId);
    if (product) setValue("sku", product.sku, { shouldValidate: true });
  };

  const processSubmit = async (data: TransferFormValues) => {
    setSubmitError(null);
    try {
      const created = await createTransfer({
        sourceLocationId: data.sourceLocationId,
        destLocationId: data.destLocationId,
        productId: data.productId,
        sku: data.sku,
        quantity: data.quantity,
        note: data.note,
      });

      await validateOperation("transfers", created.id);

      const localEntry: LedgerEntry = {
        id: created.id,
        type: "transfer",
        timestamp: created.timestamp ?? new Date().toISOString(),
        sku: data.sku,
        quantity: data.quantity,
        sourceLocationId: data.sourceLocationId,
        destLocationId: data.destLocationId,
      };
      onSubmit?.(localEntry);
      reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const apiError = productsError || locationsError;

  return (
    <Card className="max-w-xl w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">Internal Transfer</CardTitle>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Transfer validated and stock moved between locations.
          </div>
        )}
        {submitError && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}
        {apiError && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Could not load reference data: {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(processSubmit)} noValidate className="flex flex-col gap-5">
          {/* Source Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sourceLocationId">Source Location <span className="text-red-500">*</span></Label>
            <Select onValueChange={(val) => setValue("sourceLocationId", val, { shouldValidate: true })} disabled={locationsLoading}>
              <SelectTrigger id="sourceLocationId" className={errors.sourceLocationId ? "border-red-500" : ""}>
                <SelectValue placeholder={locationsLoading ? "Loading…" : "Select source location…"} />
              </SelectTrigger>
              <SelectContent>
                {(apiLocations ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.sourceLocationId && <p className="text-sm text-red-500">{errors.sourceLocationId.message}</p>}
          </div>

          {/* Destination Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destLocationId">Destination Location <span className="text-red-500">*</span></Label>
            <Select onValueChange={(val) => setValue("destLocationId", val, { shouldValidate: true })} disabled={locationsLoading}>
              <SelectTrigger id="destLocationId" className={errors.destLocationId ? "border-red-500" : ""}>
                <SelectValue placeholder={locationsLoading ? "Loading…" : "Select destination location…"} />
              </SelectTrigger>
              <SelectContent>
                {(apiLocations ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.destLocationId && <p className="text-sm text-red-500">{errors.destLocationId.message}</p>}
          </div>

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

          {/* SKU */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">SKU (auto-filled)</Label>
            <Input id="sku" readOnly placeholder="Select a product to auto-fill" {...register("sku")} className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">Quantity <span className="text-red-500">*</span></Label>
            <Input id="quantity" type="number" min={1} placeholder="e.g. 25" {...register("quantity", { valueAsNumber: true })} className={errors.quantity ? "border-red-500" : ""} />
            {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Input id="note" placeholder="Optional transfer note" {...register("note")} />
          </div>

          <Button type="submit" disabled={isSubmitting} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : "Record Transfer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
