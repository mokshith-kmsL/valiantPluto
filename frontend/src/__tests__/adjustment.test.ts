// Feature: stocksense-frontend, Property 6: Adjustment Variance Computation
//
// Validates: Requirements A.1, A.2

import * as fc from "fast-check";
import { describe, it, expect } from "vitest";
import { computeVariance } from "@/lib/utils";

describe("Property 6: Adjustment variance computation", () => {
  it("equals newQty - currentQty for all non-negative integer pairs", () => {
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (newQty, currentQty) => {
        expect(computeVariance(newQty, currentQty)).toBe(newQty - currentQty);
      }),
      { numRuns: 200 }
    );
  });

  it("returns a positive number when newQty > currentQty (stock increase)", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 999998 }).chain((base) =>
          fc.tuple(
            fc.integer({ min: base + 1, max: base + 100 }),
            fc.constant(base)
          )
        ),
        ([newQty, currentQty]) => {
          expect(computeVariance(newQty, currentQty)).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns a negative number when newQty < currentQty (stock decrease)", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 999998 }).chain((base) =>
          fc.tuple(
            fc.constant(base),
            fc.integer({ min: base + 1, max: base + 100 })
          )
        ),
        ([newQty, currentQty]) => {
          expect(computeVariance(newQty, currentQty)).toBeLessThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns zero when newQty equals currentQty (no change)", () => {
    fc.assert(
      fc.property(fc.nat(), (qty) => {
        expect(computeVariance(qty, qty)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it("specific example: variance of 100 - 90 = 10", () => {
    expect(computeVariance(100, 90)).toBe(10);
  });

  it("specific example: variance of 50 - 80 = -30", () => {
    expect(computeVariance(50, 80)).toBe(-30);
  });

  it("specific example: variance of 0 - 0 = 0", () => {
    expect(computeVariance(0, 0)).toBe(0);
  });
});
