// Feature: stocksense-frontend, Property 5: Delivery State Machine Transitions
//
// Validates: Requirements DL.1, DL.2, DL.3

import { describe, it, expect } from "vitest";
import { nextDeliveryStep } from "@/lib/utils";
import type { DeliveryStep } from "@/lib/types";

describe("Property 5: Delivery state machine transitions", () => {
  it("advances pick → pack", () => {
    expect(nextDeliveryStep("pick")).toBe("pack");
  });

  it("advances pack → validate", () => {
    expect(nextDeliveryStep("pack")).toBe("validate");
  });

  it("advances validate → done", () => {
    expect(nextDeliveryStep("validate")).toBe("done");
  });

  it("covers all three valid step transitions exhaustively", () => {
    const transitions: Array<[DeliveryStep, DeliveryStep | "done"]> = [
      ["pick", "pack"],
      ["pack", "validate"],
      ["validate", "done"],
    ];
    for (const [from, to] of transitions) {
      expect(nextDeliveryStep(from)).toBe(to);
    }
  });

  it("does not skip any step — pick never jumps directly to validate", () => {
    expect(nextDeliveryStep("pick")).not.toBe("validate");
    expect(nextDeliveryStep("pick")).not.toBe("done");
  });

  it("does not skip any step — pack never jumps directly to done", () => {
    expect(nextDeliveryStep("pack")).not.toBe("done");
    expect(nextDeliveryStep("pack")).not.toBe("pick");
  });
});
