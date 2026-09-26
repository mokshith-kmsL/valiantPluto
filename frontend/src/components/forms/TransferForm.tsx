"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { TransferSchema, type TransferFormValues } from "@/lib/schemas/transfer.schema";
import { locations } from "@/data/locations";
import { products } from "@/data/products";
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
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue("sku", product.sku, { shouldValidate: true });
    }
  };

  const processSubmit = (data: TransferFormValues) => {
    const entry: LedgerEntry = {
      id: generateId(),
      type: "transfer",
      timestamp: new Date().toISOString(),
      sku: data.sku,
      quantity: data.quantity,
      sourceLocationId: data.sourceLocationId,
      destLocationId: data.destLocationId,
    };
    onSubmit?.(entry);
    reset();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <Card className="max-w-xl w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">
          Internal Transfer
        </CardTitle>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Transfer recorded. Stock has been moved between locations.
          </div>
        )}

        <form onSubmit={handleSubmit(processSubmit)} noValidate className="flex flex-col gap-5">
          {/* Source Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sourceLocationId">
              Source Location <span className="text-red-500">*</span>
            </Label>
            <Select onValueChange={(val) => setValue("sourceLocationId", val, { shouldValidate: true })}>
              <SelectTrigger
                id="sourceLocationId"
                className={errors.sourceLocationId ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Select source location…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.sourceLocationId && (
              <p className="text-sm text-red-500">{errors.sourceLocationId.message}</p>
            )}
          </div>

          {/* Destination Location */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="destLocationId">
              Destination Location <span className="text-red-500">*</span>
            </Label>
            <Select onValueChange={(val) => setValue("destLocationId", val, { shouldValidate: true })}>
              <SelectTrigger
                id="destLocationId"
                className={errors.destLocationId ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Select destination location…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.destLocationId && (
              <p className="text-sm text-red-500">{errors.destLocationId.message}</p>
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

          {/* SKU — read-only, auto-filled */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">SKU (auto-filled)</Label>
            <Input
              id="sku"
              readOnly
              placeholder="Select a product to auto-fill"
              {...register("sku")}
              className="bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            {errors.sku && (
              <p className="text-sm text-red-500">{errors.sku.message}</p>
            )}
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              placeholder="e.g. 25"
              {...register("quantity", { valueAsNumber: true })}
              className={errors.quantity ? "border-red-500" : ""}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500">{errors.quantity.message}</p>
            )}
          </div>

          {/* Note (optional) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="Optional transfer note"
              {...register("note")}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
            Record Transfer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
