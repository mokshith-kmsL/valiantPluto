"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { ReceiptSchema, type ReceiptFormValues } from "@/lib/schemas/receipt.schema";
import { suppliers } from "@/data/suppliers";
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

interface ReceiptFormProps {
  onSubmit?: (entry: LedgerEntry) => void;
}

export default function ReceiptForm({ onSubmit }: ReceiptFormProps) {
  const [success, setSuccess] = useState(false);

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

  const selectedProductId = watch("productId");

  // Auto-fill SKU when a product is selected
  const handleProductChange = (productId: string) => {
    setValue("productId", productId, { shouldValidate: true });
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue("sku", product.sku, { shouldValidate: true });
    }
  };

  const processSubmit = (data: ReceiptFormValues) => {
    const product = products.find((p) => p.id === data.productId);
    const entry: LedgerEntry = {
      id: generateId(),
      type: "receipt",
      timestamp: new Date().toISOString(),
      sku: data.sku,
      quantity: data.quantity,
      supplierId: data.supplierId,
      warehouseId: undefined,
      productName: product?.name,
      referenceNote: data.referenceNote,
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
          New Receipt — Incoming Inventory
        </CardTitle>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Receipt recorded successfully. Stock has been updated.
          </div>
        )}

        <form onSubmit={handleSubmit(processSubmit)} noValidate className="flex flex-col gap-5">
          {/* Supplier */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplierId">
              Supplier <span className="text-red-500">*</span>
            </Label>
            <Select onValueChange={(val) => setValue("supplierId", val, { shouldValidate: true })}>
              <SelectTrigger
                id="supplierId"
                className={errors.supplierId ? "border-red-500 focus:ring-red-500" : ""}
              >
                <SelectValue placeholder="Select a supplier…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplierId && (
              <p className="text-sm text-red-500 mt-0.5">{errors.supplierId.message}</p>
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
                className={errors.productId ? "border-red-500 focus:ring-red-500" : ""}
              >
                <SelectValue placeholder="Select a product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId && (
              <p className="text-sm text-red-500 mt-0.5">{errors.productId.message}</p>
            )}
          </div>

          {/* SKU — auto-filled, but editable */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">
              SKU <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sku"
              placeholder="e.g. WIDGET01"
              {...register("sku")}
              className={errors.sku ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.sku && (
              <p className="text-sm text-red-500 mt-0.5">{errors.sku.message}</p>
            )}
          </div>

          {/* Quantity Received */}
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
              className={errors.quantity ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500 mt-0.5">{errors.quantity.message}</p>
            )}
          </div>

          {/* Reference Number (optional) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referenceNote">Reference Number</Label>
            <Input
              id="referenceNote"
              placeholder="Optional reference or PO number"
              {...register("referenceNote")}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white">
            Record Receipt
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
