import { z } from "zod";

export const ReceiptSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  productId: z.string().min(1, "Product is required"),
  locationId: z.string().min(1, "Destination location is required"),
  sku: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "SKU must be alphanumeric (hyphens and underscores allowed)")
    .min(1, "SKU is required")
    .max(50, "SKU must not exceed 50 characters"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be a positive integer")
    .max(999999),
  referenceNote: z.string().max(100).optional(),
});

export type ReceiptFormValues = z.infer<typeof ReceiptSchema>;
