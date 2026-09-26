"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, PackageCheck, PackageSearch, ShieldCheck } from "lucide-react";

import { DeliverySchema, type DeliveryFormValues } from "@/lib/schemas/delivery.schema";
import { useFetch } from "@/hooks/useFetch";
import {
  fetchProducts,
  fetchLocations,
  createDelivery,
  validateOperation,
  type ApiProduct,
  type ApiLocation,
} from "@/lib/api";
import { customers } from "@/data/customers"; // no /api/customers endpoint yet
import { nextDeliveryStep } from "@/lib/utils";
import type { LedgerEntry, DeliveryStep } from "@/lib/types";

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

interface DeliveryFormProps {
  onSubmit?: (entry: LedgerEntry) => void;
}

const STEP_ORDER: DeliveryStep[] = ["pick", "pack", "validate"];

export default function DeliveryForm({ onSubmit }: DeliveryFormProps) {
  const [step, setStep] = useState<DeliveryStep>("pick");
  // Stores the draft ID returned by POST /api/deliveries
  const [draftId, setDraftId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: apiProducts, loading: productsLoading, error: productsError } =
    useFetch<ApiProduct[]>(fetchProducts);
  const { data: apiLocations, loading: locationsLoading } =
    useFetch<ApiLocation[]>(fetchLocations);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(DeliverySchema),
  });

  const formValues = watch();

  const handleProductChange = (productId: string) => {
    setValue("productId", productId, { shouldValidate: true });
    const product = apiProducts?.find((p) => p.id === productId);
    if (product) setValue("sku", product.sku, { shouldValidate: true });
  };

  // Step 1 → Step 2: create the draft delivery record in the API
  const handlePick = handleSubmit(async (data) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createDelivery({
        source_location_id: data.locationId,
        customer_name:      data.customerId,
        created_by:         "user",
      });

      // Add product line
      await fetch(`http://localhost:3000/api/deliveries/${created.id}/lines`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ product_id: data.productId, qty: data.quantity }),
      });
      setDraftId(created.id);
      setStep("pack");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create delivery");
    } finally {
      setSubmitting(false);
    }
  });

  // Step 2 → Step 3: just advance the UI step
  const handlePack = () => {
    const next = nextDeliveryStep("pack");
    if (next !== "done") setStep(next);
  };

  // Step 3: validate (commit stock deduction)
  const handleValidate = async () => {
    if (!draftId) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await validateOperation("deliveries", draftId);
      const product = apiProducts?.find((p) => p.id === formValues.productId);
      const localEntry: LedgerEntry = {
        id: draftId,
        type: "delivery",
        timestamp: new Date().toISOString(),
        sku: formValues.sku,
        quantity: formValues.quantity,
        customerId: formValues.customerId,
        deliveryRef: formValues.deliveryRef,
        productName: product?.name,
      };
      onSubmit?.(localEntry);
      reset();
      setStep("pick");
      setDraftId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <Card className="max-w-xl w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">
          New Delivery Order — Outgoing Inventory
        </CardTitle>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-3">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  i < stepIndex ? "bg-emerald-500 text-white"
                  : i === stepIndex ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${i === stepIndex ? "text-slate-800" : "text-slate-400"}`}>
                {s === "pick" ? "Pick" : s === "pack" ? "Pack" : "Validate"}
              </span>
              {i < STEP_ORDER.length - 1 && <span className="h-px w-6 bg-slate-200 hidden sm:block" />}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Delivery validated. Stock has been decremented.
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

        <div className="flex flex-col gap-5">
          {/* ── STEP 1: PICK ── */}
          {step === "pick" && (
            <form onSubmit={handlePick} noValidate className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customerId">Customer <span className="text-red-500">*</span></Label>
                <Select onValueChange={(val) => setValue("customerId", val, { shouldValidate: true })}>
                  <SelectTrigger id="customerId" className={errors.customerId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select a customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customerId && <p className="text-sm text-red-500">{errors.customerId.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="locationId">Source Warehouse <span className="text-red-500">*</span></Label>
                <Select onValueChange={(val) => setValue("locationId", val, { shouldValidate: true })} disabled={locationsLoading}>
                  <SelectTrigger id="locationId" className={errors.locationId ? "border-red-500" : ""}>
                    <SelectValue placeholder={locationsLoading ? "Loading…" : "Select a warehouse…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(apiLocations ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.locationId && <p className="text-sm text-red-500">{errors.locationId.message}</p>}
              </div>

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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sku">SKU <span className="text-red-500">*</span></Label>
                <Input id="sku" placeholder="e.g. WIDGET01" {...register("sku")} className={errors.sku ? "border-red-500" : ""} />
                {errors.sku && <p className="text-sm text-red-500">{errors.sku.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantity">Quantity to Deliver <span className="text-red-500">*</span></Label>
                <Input id="quantity" type="number" min={1} placeholder="e.g. 10" {...register("quantity", { valueAsNumber: true })} className={errors.quantity ? "border-red-500" : ""} />
                {errors.quantity && <p className="text-sm text-red-500">{errors.quantity.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deliveryRef">Delivery Reference</Label>
                <Input id="deliveryRef" placeholder="Optional reference" {...register("deliveryRef")} />
              </div>

              <Button type="submit" disabled={submitting} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : <><PackageSearch className="h-4 w-4 mr-2" />Confirm Pick</>}
              </Button>
            </form>
          )}

          {/* ── STEP 2: PACK ── */}
          {step === "pack" && (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-800 mb-3">Review before packing:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="text-slate-500">SKU</span>
                  <span className="font-medium">{formValues.sku || "—"}</span>
                  <span className="text-slate-500">Quantity</span>
                  <span className="font-medium">{formValues.quantity ?? "—"}</span>
                  <span className="text-slate-500">Draft ID</span>
                  <span className="font-mono text-xs text-slate-400">{draftId}</span>
                </div>
              </div>
              <Button onClick={handlePack} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
                <PackageCheck className="h-4 w-4 mr-2" />Confirm Pack
              </Button>
            </>
          )}

          {/* ── STEP 3: VALIDATE ── */}
          {step === "validate" && (
            <>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm">
                <p className="font-semibold text-slate-800 mb-3">Final confirmation:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700">
                  <span className="text-slate-500">SKU</span>
                  <span className="font-medium">{formValues.sku || "—"}</span>
                  <span className="text-slate-500">Quantity</span>
                  <span className="font-medium">{formValues.quantity ?? "—"}</span>
                </div>
                <p className="mt-3 text-xs text-blue-600 font-medium">
                  Validating will call POST /api/deliveries/{draftId}/validate to deduct stock.
                </p>
              </div>
              <Button onClick={handleValidate} disabled={submitting} className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating…</> : <><ShieldCheck className="h-4 w-4 mr-2" />Complete Delivery</>}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
