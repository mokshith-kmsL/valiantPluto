// Feature: stocksense-frontend, Property 1: Zod SKU schema accepts valid / rejects invalid
// Feature: stocksense-frontend, Property 2: Zod Quantity schema accepts only positive integers
// Feature: stocksense-frontend, Property 3: TransferSchema superRefine rejects same source/dest
//
// Validates: Requirements R.3, R.4, T.1, Z.1–Z.3

import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import { ReceiptSchema } from "@/lib/schemas/receipt.schema";
import { DeliverySchema } from "@/lib/schemas/delivery.schema";
import { TransferSchema } from "@/lib/schemas/transfer.schema";
import { AdjustmentSchema } from "@/lib/schemas/adjustment.schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const alphanumericChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generates valid SKU strings: 1–50 alphanumeric characters */
const validSku = fc.stringOf(fc.constantFrom(...alphanumericChars), {
  minLength: 1,
  maxLength: 50,
});

/** Generates strings that are definitely NOT valid SKUs */
const invalidSku = fc
  .string({ minLength: 1 })
  .filter((s) => !/^[a-zA-Z0-9]{1,50}$/.test(s));

// ─── Property 1: SKU Schema — Valid / Invalid Partition ──────────────────────

describe("Property 1: SKU schema valid/invalid partition", () => {
  it("accepts any alphanumeric string between 1 and 50 characters", () => {
    fc.assert(
      fc.property(validSku, (sku) => {
        // Test against ReceiptSchema as representative SKU validator
        const result = ReceiptSchema.safeParse({
          supplierId: "S001",
          productId: "P001",
          sku,
          quantity: 1,
        });
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects strings that are not purely alphanumeric or exceed 50 chars", () => {
    fc.assert(
      fc.property(invalidSku, (sku) => {
        const result = ReceiptSchema.safeParse({
          supplierId: "S001",
          productId: "P001",
          sku,
          quantity: 1,
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects an empty SKU", () => {
    const result = ReceiptSchema.safeParse({
      supplierId: "S001",
      productId: "P001",
      sku: "",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a SKU over 50 characters", () => {
    const result = ReceiptSchema.safeParse({
      supplierId: "S001",
      productId: "P001",
      sku: "A".repeat(51),
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a SKU with special characters", () => {
    const result = ReceiptSchema.safeParse({
      supplierId: "S001",
      productId: "P001",
      sku: "SKU-001",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Property 2: Quantity Schema — Positive Integer Partition ────────────────

describe("Property 2: Quantity schema positive-integer partition", () => {
  it("accepts positive integers (ReceiptSchema up to 999999)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999999 }), (quantity) => {
        const result = ReceiptSchema.safeParse({
          supplierId: "S001",
          productId: "P001",
          sku: "WIDGET01",
          quantity,
        });
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects zero", () => {
    const result = ReceiptSchema.safeParse({
      supplierId: "S001",
      productId: "P001",
      sku: "WIDGET01",
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative integers", () => {
    fc.assert(
      fc.property(fc.integer({ min: -999999, max: -1 }), (quantity) => {
        const result = ReceiptSchema.safeParse({
          supplierId: "S001",
          productId: "P001",
          sku: "WIDGET01",
          quantity,
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects non-integer floats", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.001, max: 999998.999 }).filter((n) => !Number.isInteger(n)),
        (quantity) => {
          const result = ReceiptSchema.safeParse({
            supplierId: "S001",
            productId: "P001",
            sku: "WIDGET01",
            quantity,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects quantities exceeding the maximum (999999)", () => {
    const result = ReceiptSchema.safeParse({
      supplierId: "S001",
      productId: "P001",
      sku: "WIDGET01",
      quantity: 1000000,
    });
    expect(result.success).toBe(false);
  });

  it("also validates quantity in AdjustmentSchema (nonnegative)", () => {
    // physicalQty in AdjustmentSchema is nonnegative, so 0 is valid
    const result = AdjustmentSchema.safeParse({
      productId: "P001",
      locationId: "L001",
      sku: "WIDGET01",
      physicalQty: 0,
      systemQty: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Property 3: Transfer superRefine — Same-Location Rejection ──────────────

describe("Property 3: TransferSchema superRefine rejects same source and destination", () => {
  it("rejects any transfer where sourceLocationId equals destLocationId", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (locationId) => {
          const result = TransferSchema.safeParse({
            sourceLocationId: locationId,
            destLocationId: locationId,
            productId: "P001",
            sku: "WIDGET01",
            quantity: 10,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            const destError = result.error.issues.find(
              (issue) => issue.path.includes("destLocationId")
            );
            expect(destError).toBeDefined();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("accepts a transfer where sourceLocationId differs from destLocationId", () => {
    const result = TransferSchema.safeParse({
      sourceLocationId: "LOC001",
      destLocationId: "LOC002",
      productId: "P001",
      sku: "WIDGET01",
      quantity: 10,
    });
    expect(result.success).toBe(true);
  });

  it("always errors on destLocationId when locations match", () => {
    const locationId = "WAREHOUSE_A";
    const result = TransferSchema.safeParse({
      sourceLocationId: locationId,
      destLocationId: locationId,
      productId: "P001",
      sku: "WIDGET01",
      quantity: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.flatMap((i) => i.path);
      expect(paths).toContain("destLocationId");
    }
  });
});

// ─── Additional schema smoke tests ───────────────────────────────────────────

describe("DeliverySchema — basic validation", () => {
  it("accepts a valid delivery payload", () => {
    const result = DeliverySchema.safeParse({
      customerId: "C001",
      productId: "P001",
      sku: "WIDGET01",
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = DeliverySchema.safeParse({
      sku: "WIDGET01",
      quantity: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe("AdjustmentSchema — basic validation", () => {
  it("accepts a valid adjustment payload", () => {
    const result = AdjustmentSchema.safeParse({
      productId: "P001",
      locationId: "L001",
      sku: "WIDGET01",
      physicalQty: 100,
      systemQty: 90,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative physicalQty", () => {
    const result = AdjustmentSchema.safeParse({
      productId: "P001",
      locationId: "L001",
      sku: "WIDGET01",
      physicalQty: -1,
      systemQty: 0,
    });
    expect(result.success).toBe(false);
  });
});
