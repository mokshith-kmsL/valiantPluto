import { z } from "zod";

export const TransferSchema = z
  .object({
    sourceLocationId: z.string().min(1, "Source Location is required"),
    destLocationId: z.string().min(1, "Destination Location is required"),
    productId: z.string().min(1, "Product is required"),
    // sku is auto-populated from the selected product but still validated
    sku: z.string().min(1, "SKU is required").max(50),
    quantity: z
      .number({ error: "Quantity must be a number" })
      .int()
      .positive("Quantity must be a positive integer")
      .max(999999),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.sourceLocationId &&
      data.destLocationId &&
      data.sourceLocationId === data.destLocationId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["destLocationId"],
        message: "Source and Destination locations must be different",
      });
    }
  });

export type TransferFormValues = z.infer<typeof TransferSchema>;
