import { z } from "zod";

export const AdjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  locationId: z.string().min(1, "Location is required"),
  sku: z
    .string()
    .regex(/^[a-zA-Z0-9]+$/, "SKU must be alphanumeric")
    .min(1, "SKU is required")
    .max(50),
  physicalQty: z
    .number({ error: "Quantity must be a number" })
    .int()
    .nonnegative("Quantity must be zero or a positive number")
    .max(999999),
  systemQty: z.number().int().nonnegative(),
});

export type AdjustmentFormValues = z.infer<typeof AdjustmentSchema>;
