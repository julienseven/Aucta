import { describe, expect, it } from "vitest";
import { assertTransition, AUCTION_STATES, canTransition, type AuctionState } from "../../src/lib/auction/states";

describe("explicit auction lifecycle", () => {
  it("supports the approved path through internal settlement to completion", () => {
    const path: AuctionState[] = ["DRAFT", "PENDING_REVIEW", "SCHEDULED", "LIVE", "ENDED", "AWAITING_PAYMENT", "PAID", "FULFILLMENT", "COMPLETED"];
    for (let index = 1; index < path.length; index++) expect(() => assertTransition(path[index - 1], path[index])).not.toThrow();
  });

  it.each([["PENDING_REVIEW", "REJECTED"], ["REJECTED", "DRAFT"], ["LIVE", "CANCELLED"], ["ENDED", "NO_SALE"], ["AWAITING_PAYMENT", "PAYMENT_FAILED"], ["FULFILLMENT", "DISPUTED"], ["DISPUTED", "REFUNDED"], ["DISPUTED", "FULFILLMENT"]] as const)("allows %s to %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([["DRAFT", "LIVE"], ["LIVE", "PAID"], ["AWAITING_PAYMENT", "COMPLETED"], ["PAID", "REFUNDED"], ["COMPLETED", "LIVE"], ["REFUNDED", "PAID"], ["CANCELLED", "LIVE"]] as const)("rejects %s to %s", (from, to) => {
    expect(() => assertTransition(from, to)).toThrow("Illegal auction transition");
  });

  it("does not reopen terminal outcomes or accept arbitrary same-state writes", () => {
    for (const state of ["CANCELLED", "NO_SALE", "PAYMENT_FAILED", "REFUNDED"] as const) {
      for (const target of AUCTION_STATES) expect(canTransition(state, target)).toBe(false);
    }
    for (const state of AUCTION_STATES) expect(canTransition(state, state)).toBe(false);
  });
});
