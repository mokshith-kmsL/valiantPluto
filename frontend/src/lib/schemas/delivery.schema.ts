import { z } from "zod";

export const DeliverySchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  productId: z.string().min(1, "Product is required"),
  sku: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "SKU must be alphanumeric (hyphens and underscores allowed)")
    .min(1, "SKU is required")
    .max(50, "SKU must not exceed 50 characters"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int()
    .positive("Quantity must be a positive integer")
    .max(9999),
  deliveryRef: z.string().max(100).optional(),
});

export type DeliveryFormValues = z.infer<typeof DeliverySchema>;
