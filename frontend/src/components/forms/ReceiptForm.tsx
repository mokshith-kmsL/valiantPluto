"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { ReceiptSchema, type ReceiptFormValues } from "@/lib/schemas/receipt.schema";
import { useFetch } from "@/hooks/useFetch";
import {
  fetchProducts,
  createReceipt,
  validateOperation,
  type ApiProduct,
} from "@/lib/api";
// Suppliers have no dedicated endpoint yet — fall back to static list
import { suppliers } from "@/data/suppliers";
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

interface ReceiptFormProps {
  onSubmit?: (entry: LedgerEntry) => void;
}

export default function ReceiptForm({ onSubmit }: ReceiptFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch products from the real API
  const { data: apiProducts, loading: productsLoading, error: productsError } =
    useFetch<ApiProduct[]>(fetchProducts);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(ReceiptSchema),
  });

  const handleProductChange = (productId: string) => {
    setValue("productId", productId, { shouldValidate: true });
    const product = apiProducts?.find((p) => p.id === productId);
    if (product) setValue("sku", product.sku, { shouldValidate: true });
  };

  const processSubmit = async (data: ReceiptFormValues) => {
    setSubmitError(null);
    try {
      // 1. Create the draft operation
      const created = await createReceipt({
        supplierId: data.supplierId,
        productId: data.productId,
        sku: data.sku,
        quantity: data.quantity,
        referenceNote: data.referenceNote,
      });

      // 2. Validate (commit the stock move)
      await validateOperation("receipts", created.id);

      // 3. Notify parent with a local ledger entry for the session log
      const product = apiProducts?.find((p) => p.id === data.productId);
      const localEntry: LedgerEntry = {
        id: created.id,
        type: "receipt",
        timestamp: created.timestamp ?? new Date().toISOString(),
        sku: data.sku,
        quantity: data.quantity,
        supplierId: data.supplierId,
        productName: product?.name,
        referenceNote: data.referenceNote,
      };
      onSubmit?.(localEntry);
      reset();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  return (
    <Card className="max-w-xl w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">
          New Receipt — Incoming Inventory
        </CardTitle>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Receipt validated and stock updated.
          </div>
        )}
        {submitError && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}
        {productsError && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Could not load product list: {productsError}
          </div>
        )}

        <form onSubmit={handleSubmit(processSubmit)} noValidate className="flex flex-col gap-5">
          {/* Supplier */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplierId">
              Supplier <span className="text-red-500">*</span>
            </Label>
            <Select onValueChange={(val) => setValue("supplierId", val, { shouldValidate: true })}>
              <SelectTrigger id="supplierId" className={errors.supplierId ? "border-red-500" : ""}>
                <SelectValue placeholder="Select a supplier…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplierId && (
              <p className="text-sm text-red-500">{errors.supplierId.message}</p>
            )}
          </div>

          {/* Product */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productId">
              Product <span className="text-red-500">*</span>
            </Label>
            <Select onValueChange={handleProductChange} disabled={productsLoading || !!productsError}>
              <SelectTrigger id="productId" className={errors.productId ? "border-red-500" : ""}>
                <SelectValue placeholder={productsLoading ? "Loading products…" : "Select a product…"} />
              </SelectTrigger>
              <SelectContent>
                {(apiProducts ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId && (
              <p className="text-sm text-red-500">{errors.productId.message}</p>
            )}
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">SKU <span className="text-red-500">*</span></Label>
            <Input
              id="sku"
              placeholder="Auto-filled from product"
              {...register("sku")}
              className={errors.sku ? "border-red-500" : ""}
            />
            {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">
              Quantity Received <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              placeholder="e.g. 50"
              {...register("quantity", { valueAsNumber: true })}
              className={errors.quantity ? "border-red-500" : ""}
            />
            {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
          </div>

          {/* Reference */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referenceNote">Reference Number</Label>
            <Input id="referenceNote" placeholder="Optional PO reference" {...register("referenceNote")} />
          </div>

          <Button type="submit" disabled={isSubmitting} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : "Record Receipt"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
