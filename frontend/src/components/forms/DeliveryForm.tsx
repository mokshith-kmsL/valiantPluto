"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2, PackageCheck, PackageSearch, ShieldCheck } from "lucide-react";

import { DeliverySchema, type DeliveryFormValues } from "@/lib/schemas/delivery.schema";
import { customers } from "@/data/customers";
import { products } from "@/data/products";
import { generateId, nextDeliveryStep } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";

interface DeliveryFormProps {
  onSubmit?: (entry: LedgerEntry) => void;
}

const STEP_LABELS: Record<DeliveryStep, string> = {
  pick: "1. Pick Items",
  pack: "2. Pack Items",
  validate: "3. Validate",
};

const STEP_ORDER: DeliveryStep[] = ["pick", "pack", "validate"];

export default function DeliveryForm({ onSubmit }: DeliveryFormProps) {
  const [step, setStep] = useState<DeliveryStep>("pick");
  const [success, setSuccess] = useState(false);

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
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue("sku", product.sku, { shouldValidate: true });
    }
  };

  const advanceStep = () => {
    const next = nextDeliveryStep(step);
    if (next !== "done") setStep(next);
  };

  const processSubmit = (data: DeliveryFormValues) => {
    const product = products.find((p) => p.id === data.productId);
    const entry: LedgerEntry = {
      id: generateId(),
      type: "delivery",
      timestamp: new Date().toISOString(),
      sku: data.sku,
      quantity: data.quantity,
      customerId: data.customerId,
      deliveryRef: data.deliveryRef,
      productName: product?.name,
    };
    onSubmit?.(entry);
    reset();
    setStep("pick");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
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
                  i < stepIndex
                    ? "bg-emerald-500 text-white"
                    : i === stepIndex
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  i === stepIndex ? "text-slate-800" : "text-slate-400"
                }`}
              >
                {s === "pick" ? "Pick" : s === "pack" ? "Pack" : "Validate"}
              </span>
              {i < STEP_ORDER.length - 1 && (
                <span className="h-px w-6 bg-slate-200 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Delivery recorded. Stock has been decremented.
          </div>
        )}

        <form onSubmit={handleSubmit(processSubmit)} noValidate className="flex flex-col gap-5">
          {/* ── STEP 1: PICK ─────────────────────────────────── */}
          {step === "pick" && (
            <>
              {/* Customer */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customerId">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(val) => setValue("customerId", val, { shouldValidate: true })}>
                  <SelectTrigger
                    id="customerId"
                    className={errors.customerId ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select a customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customerId && (
                  <p className="text-sm text-red-500">{errors.customerId.message}</p>
                )}
              </div>

              {/* Product */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="productId">
                  Product <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={handleProductChange}>
                  <SelectTrigger
                    id="productId"
                    className={errors.productId ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.sku}
                      </SelectItem>
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
                  placeholder="e.g. WIDGET01"
                  {...register("sku")}
                  className={errors.sku ? "border-red-500" : ""}
                />
                {errors.sku && (
                  <p className="text-sm text-red-500">{errors.sku.message}</p>
                )}
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantity">
                  Quantity to Deliver <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  {...register("quantity", { valueAsNumber: true })}
                  className={errors.quantity ? "border-red-500" : ""}
                />
                {errors.quantity && (
                  <p className="text-sm text-red-500">{errors.quantity.message}</p>
                )}
              </div>

              {/* Delivery Ref */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deliveryRef">Delivery Reference</Label>
                <Input
                  id="deliveryRef"
                  placeholder="Optional reference"
                  {...register("deliveryRef")}
                />
              </div>

              <Button
                type="button"
                onClick={advanceStep}
                className="mt-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PackageSearch className="h-4 w-4 mr-2" />
                Confirm Pick
              </Button>
            </>
          )}

          {/* ── STEP 2: PACK ─────────────────────────────────── */}
          {step === "pack" && (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                <p className="font-semibold text-slate-800 mb-3">Review before packing:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="text-slate-500">SKU</span>
                  <span className="font-medium">{formValues.sku || "—"}</span>
                  <span className="text-slate-500">Quantity</span>
                  <span className="font-medium">{formValues.quantity ?? "—"}</span>
                </div>
              </div>
              <Button
                type="button"
                onClick={advanceStep}
                className="mt-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                Confirm Pack
              </Button>
            </>
          )}

          {/* ── STEP 3: VALIDATE ─────────────────────────────── */}
          {step === "validate" && (
            <>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-slate-800 mb-3">Final confirmation:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700">
                  <span className="text-slate-500">SKU</span>
                  <span className="font-medium">{formValues.sku || "—"}</span>
                  <span className="text-slate-500">Quantity</span>
                  <span className="font-medium">{formValues.quantity ?? "—"}</span>
                </div>
                <p className="mt-3 text-xs text-blue-600 font-medium">
                  Submitting will deduct this quantity from stock.
                </p>
              </div>
              <Button type="submit" className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Complete Delivery
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
