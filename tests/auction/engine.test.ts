import { describe, expect, it } from "vitest";
import { BidError, createReferenceAuction, minimumBid, placeProxyBid, publicSnapshot, settleAuction, type BidRequest, type ReferenceAuction } from "../../src/lib/auction/engine";
import { MAX_IDR } from "../../src/lib/config";

const NOW = 1_800_000_000_000;
function auction(overrides: Partial<Parameters<typeof createReferenceAuction>[0]> = {}) {
  return createReferenceAuction({ id: "auction-1", sellerId: "seller-1", startingPrice: 1_000_000, startsAt: NOW - 60_000, endsAt: NOW + 600_000, ...overrides });
}
function request(bidderId = "buyer-a", maximum = 2_000_000, overrides: Partial<BidRequest> = {}): BidRequest {
  return { bidderId, maximum, emailVerified: true, suspended: false, idempotencyKey: `request-${bidderId}-${maximum}`, now: NOW, ...overrides };
}
function bid(state: ReferenceAuction, bidderId: string, maximum: number, overrides: Partial<BidRequest> = {}) {
  return placeProxyBid(state, request(bidderId, maximum, overrides));
}

describe("auction reference input validation", () => {
  it.each([0, -1, 1.5, MAX_IDR + 1])("rejects invalid opening price %s", (startingPrice) => {
    expect(() => auction({ startingPrice })).toThrow();
  });

  it("validates reserve, increment and date bounds", () => {
    expect(() => auction({ reservePrice: 999_999 })).toThrow();
    expect(() => auction({ incrementOverride: 0 })).toThrow();
    expect(() => auction({ endsAt: NOW - 60_000 })).toThrow();
    expect(() => auction({ startsAt: Number.NaN })).toThrow();
  });

  it.each([
    [{ bidderId: null }, "UNAUTHENTICATED"],
    [{ bidderId: "seller-1" }, "SELF_BID"],
    [{ emailVerified: false }, "BIDDER_INELIGIBLE"],
    [{ suspended: true }, "BIDDER_INELIGIBLE"],
    [{ maximum: 1.5 }, "INVALID_AMOUNT"],
    [{ maximum: -1 }, "INVALID_AMOUNT"],
    [{ maximum: MAX_IDR + 1 }, "INVALID_AMOUNT"],
    [{ maximum: 999_999 }, "BID_TOO_LOW"],
    [{ now: NOW - 60_001 }, "NOT_STARTED"],
    [{ now: NOW + 600_000 }, "EXPIRED"],
    [{ now: Number.NaN }, "INVALID_TIME"],
    [{ idempotencyKey: "bad" }, "IDEMPOTENCY_CONFLICT"],
  ] as const)("rejects %j with %s", (overrides, code) => {
    try {
      placeProxyBid(auction(), request("buyer-a", 2_000_000, overrides));
      throw new Error("Bid unexpectedly succeeded");
    } catch (error) {
      expect(error).toBeInstanceOf(BidError);
      expect((error as BidError).code).toBe(code);
    }
  });

  it.each(["DRAFT", "SCHEDULED", "CANCELLED", "NO_SALE", "AWAITING_PAYMENT"] as const)("rejects bids in %s", (status) => {
    expect(() => placeProxyBid(auction({ status }), request())).toThrow("not live");
  });
});

describe("private proxy competition", () => {
  it("charges the first bidder only the opening price", () => {
    const state = bid(auction(), "buyer-a", 2_000_000).auction;
    expect(state.currentPrice).toBe(1_000_000);
    expect(state.leaderId).toBe("buyer-a");
    expect(minimumBid(state)).toBe(1_050_000);
    expect(minimumBid(state, "buyer-a")).toBe(2_000_001);
  });

  it("automatically advances the incumbent by the applicable second-price increment", () => {
    const first = bid(auction(), "buyer-a", 2_000_000).auction;
    const second = bid(first, "buyer-b", 1_300_000).auction;
    expect(second.currentPrice).toBe(1_350_000);
    expect(second.leaderId).toBe("buyer-a");
    expect(second.bidCount).toBe(2);
    expect(second.proxies).toHaveLength(2);
  });

  it("caps the visible price at the winner's maximum", () => {
    const first = bid(auction(), "buyer-a", 1_325_000).auction;
    const second = bid(first, "buyer-b", 1_300_000).auction;
    expect(second.currentPrice).toBe(1_325_000);
  });

  it("gives equal maxima to the earlier equivalent maximum, including identical timestamps", () => {
    const first = bid(auction(), "buyer-a", 2_000_000).auction;
    const second = bid(first, "buyer-b", 2_000_000).auction;
    expect(second.leaderId).toBe("buyer-a");
    expect(second.currentPrice).toBe(2_000_000);
  });

  it("assigns a fresh chronological priority when a bidder raises their maximum", () => {
    let state = bid(auction(), "buyer-a", 2_000_000).auction;
    state = bid(state, "buyer-b", 3_000_000).auction;
    state = bid(state, "buyer-a", 3_000_000).auction;
    expect(state.leaderId).toBe("buyer-b");
    expect(state.proxies.find((proxy) => proxy.bidderId === "buyer-a")!.priority).toBe(3);
  });

  it("does not increase public activity or extend for a leader's private ceiling increase", () => {
    const first = bid(auction(), "buyer-a", 2_000_000).auction;
    const result = bid(first, "buyer-a", 2_000_001, { now: first.endsAt - 1 });
    expect(result.auction.currentPrice).toBe(first.currentPrice);
    expect(result.auction.bidCount).toBe(first.bidCount);
    expect(result.auction.endsAt).toBe(first.endsAt);
    expect(result.competitive).toBe(false);
    expect(result.extended).toBe(false);
    expect(result.auction.version).toBe(first.version + 1);
  });

  it("rejects reducing or repeating a private maximum under a new request key", () => {
    const first = bid(auction(), "buyer-a", 2_000_000).auction;
    expect(() => bid(first, "buyer-a", 1_900_000)).toThrow("minimum");
    expect(() => bid(first, "buyer-a", 2_000_000, { idempotencyKey: "new-request-key" })).toThrow("minimum");
  });

  it("applies increment tiers at the second maximum and the visible minimum independently", () => {
    let state = bid(auction({ startingPrice: 900_000 }), "buyer-a", 2_000_000).auction;
    state = bid(state, "buyer-b", 999_999).auction;
    expect(state.currentPrice).toBe(1_024_999);
    expect(minimumBid(state)).toBe(1_074_999);
  });

  it("respects an auction-specific increment", () => {
    let state = bid(auction({ incrementOverride: 10_000 }), "buyer-a", 2_000_000).auction;
    state = bid(state, "buyer-b", 1_300_000).auction;
    expect(state.currentPrice).toBe(1_310_000);
  });

  it("keeps source state immutable", () => {
    const initial = auction();
    const first = bid(initial, "buyer-a", 2_000_000).auction;
    bid(first, "buyer-b", 1_300_000);
    expect(initial.proxies).toEqual([]);
    expect(initial.requests).toEqual({});
    expect(first.proxies).toHaveLength(1);
    expect(first.currentPrice).toBe(1_000_000);
  });

  it("maintains price and ceiling invariants over 100 sequential competitive events", () => {
    let state = auction();
    for (let index = 0; index < 100; index++) {
      const before = state.currentPrice;
      const maximum = minimumBid(state) + ((index * 173) % 9) * 25_000;
      state = bid(state, `buyer-${index % 7}`, maximum, { idempotencyKey: `sequence-${index}`, now: NOW + index }).auction;
      expect(state.currentPrice).toBeGreaterThanOrEqual(before);
      expect(state.currentPrice).toBeLessThanOrEqual(state.proxies[0].maximum);
      expect(new Set(state.proxies.map((proxy) => proxy.bidderId)).size).toBe(state.proxies.length);
    }
    expect(state.bidCount).toBe(100);
  });
});

describe("idempotency and privacy", () => {
  it("replays without adding bids, extension or proxy rows even after closing", () => {
    const initial = auction({ endsAt: NOW + 120_000 });
    const first = placeProxyBid(initial, request());
    const retry = placeProxyBid(first.auction, request("buyer-a", 2_000_000, { now: first.auction.endsAt + 1 }));
    expect(retry.replayed).toBe(true);
    expect(retry.auction).toBe(first.auction);
    expect(retry.extended).toBe(false);
  });

  it("rejects conflicting idempotency payloads and scopes keys per bidder", () => {
    const first = placeProxyBid(auction(), request());
    expect(() => bid(first.auction, "buyer-a", 3_000_000, { idempotencyKey: request().idempotencyKey })).toThrow("different bid");
    expect(bid(first.auction, "buyer-b", 3_000_000, { idempotencyKey: request().idempotencyKey }).replayed).toBe(false);
  });

  it("public snapshot excludes identities, maximums, reserve value and private requests", () => {
    const state = bid(auction({ reservePrice: 1_650_000 }), "private-buyer-id", 2_750_000).auction;
    const snapshot = publicSnapshot(state, NOW);
    const serialized = JSON.stringify(snapshot);
    for (const secret of ["seller-1", "private-buyer-id", "2750000", "proxies", "requests", "reservePrice", "leaderId", "settlement"]) expect(serialized).not.toContain(secret);
    expect(snapshot.hasReserve).toBe(true);
    expect(snapshot.serverTime).toBe(NOW);
  });
});

describe("hidden reserve", () => {
  it("does not push the price when the leader cannot meet the reserve", () => {
    const result = bid(auction({ reservePrice: 3_000_000 }), "buyer-a", 2_000_000).auction;
    expect(result.currentPrice).toBe(1_000_000);
    expect(result.reserveMet).toBe(false);
  });

  it("pushes to reserve when the maximum meets or exceeds it", () => {
    const result = bid(auction({ reservePrice: 1_750_000 }), "buyer-a", 2_000_000).auction;
    expect(result.currentPrice).toBe(1_750_000);
    expect(result.reserveMet).toBe(true);
  });

  it("allows a leader to privately cross reserve without manufacturing a new competitive event", () => {
    const first = bid(auction({ reservePrice: 3_000_000 }), "buyer-a", 2_000_000).auction;
    const result = bid(first, "buyer-a", 3_000_000);
    expect(result.auction.currentPrice).toBe(3_000_000);
    expect(result.auction.reserveMet).toBe(true);
    expect(result.auction.bidCount).toBe(1);
    expect(result.competitive).toBe(false);
  });
});

describe("anti-sniping boundaries", () => {
  it.each([[120_001, false], [120_000, true], [119_999, true], [1, true]])("evaluates %sms remaining", (remaining, extended) => {
    const state = auction({ endsAt: NOW + Number(remaining) });
    const result = placeProxyBid(state, request());
    expect(result.extended).toBe(extended);
    expect(result.auction.endsAt).toBe(state.endsAt + (extended ? 120_000 : 0));
  });

  it("rejects the exact expiry and later regardless of extension policy", () => {
    const state = auction({ endsAt: NOW });
    expect(() => placeProxyBid(state, request())).toThrow("ended");
  });

  it("repeated competitive late bids add to the existing end", () => {
    let state = auction({ endsAt: NOW + 120_000 });
    state = bid(state, "buyer-a", 2_000_000).auction;
    expect(state.endsAt).toBe(NOW + 240_000);
    state = bid(state, "buyer-b", 3_000_000, { now: NOW + 120_000 }).auction;
    expect(state.endsAt).toBe(NOW + 360_000);
  });
});

describe("reference settlement", () => {
  it("records no sale without bids and replays the same result", () => {
    const state = auction();
    const ended = settleAuction(state, state.endsAt);
    expect(ended.status).toBe("NO_SALE");
    expect(ended.settlement).toBeNull();
    expect(settleAuction(ended, state.endsAt + 1)).toBe(ended);
  });

  it("creates no payment obligation below reserve", () => {
    const state = bid(auction({ reservePrice: 3_000_000 }), "buyer-a", 2_000_000).auction;
    expect(settleAuction(state, state.endsAt).status).toBe("NO_SALE");
    expect(settleAuction(state, state.endsAt).settlement).toBeNull();
  });

  it("selects one buyer and immutable fee snapshot with 24-hour deadline", () => {
    const state = bid(auction(), "buyer-a", 2_000_000).auction;
    const ended = settleAuction(state, state.endsAt, 25_000);
    expect(ended.status).toBe("AWAITING_PAYMENT");
    expect(ended.settlement?.buyerId).toBe("buyer-a");
    expect(ended.settlement?.fees.buyerTotal).toBe(1_025_000);
    expect(ended.settlement?.paymentDeadline).toBe(state.endsAt + 86_400_000);
    expect(settleAuction(ended, state.endsAt + 999, 50_000)).toBe(ended);
  });

  it("does not close early or close an ineligible state", () => {
    const state = auction();
    expect(() => settleAuction(state, state.endsAt - 1)).toThrow("not eligible");
    expect(() => settleAuction({ ...state, status: "CANCELLED" }, state.endsAt)).toThrow("not eligible");
  });
});
