import { describe, expect, it } from "vitest";
import {
  canTransition,
  computeOrderTotals,
  orderNumber,
  shippingCostFor,
  shippingOptions,
} from "@/lib/order-math";

describe("order totals (whole IDR)", () => {
  it("adds shipping to hammer and computes the 7% seller commission", () => {
    const t = computeOrderTotals({ hammer: 20_000_000, shipping: 45_000 });
    expect(t.buyerFee).toBe(0);
    expect(t.sellerFee).toBe(1_400_000);
    expect(t.amountDue).toBe(20_045_000);
    expect(t.sellerPayout).toBe(18_600_000);
  });

  it("rounds fees to whole rupiah", () => {
    const t = computeOrderTotals({ hammer: 1_000_007, shipping: 0 });
    expect(Number.isInteger(t.sellerFee)).toBe(true);
    expect(t.sellerFee).toBe(70_000);
  });
});

describe("shipping options", () => {
  it("offers standard, express and free in-person collection", () => {
    const opts = shippingOptions(100_000);
    expect(opts.map((o) => o.id)).toEqual(["standard", "express", "pickup"]);
    expect(opts.find((o) => o.id === "pickup")?.cost).toBe(0);
    expect(opts.find((o) => o.id === "express")?.cost).toBe(170_000);
    expect(shippingCostFor(100_000, "pickup")).toBe(0);
    expect(shippingCostFor(100_000, "standard")).toBe(100_000);
  });
});

describe("order state machine", () => {
  it("follows the happy path", () => {
    const path = [
      "awaiting_payment",
      "paid",
      "preparing",
      "shipped",
      "delivered",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });
  it("blocks skipping dispatch", () => {
    expect(canTransition("paid", "shipped")).toBe(false);
    expect(canTransition("awaiting_payment", "completed")).toBe(false);
  });
  it("treats refunded and cancelled as terminal", () => {
    expect(canTransition("refunded", "shipped")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });
  it("allows refunds from settled states", () => {
    expect(canTransition("completed", "refunded")).toBe(true);
    expect(canTransition("disputed", "refunded")).toBe(true);
  });
});

describe("order numbers", () => {
  it("are unique-ish and prefixed", () => {
    const a = orderNumber(new Date("2026-01-02"));
    const b = orderNumber(new Date("2026-01-02"));
    expect(a.startsWith("AUCT-20260102-")).toBe(true);
    expect(a).not.toBe(b);
  });
});
