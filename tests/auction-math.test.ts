import { describe, expect, it } from "vitest";
import {
  computeVisiblePrice,
  incrementFor,
  isReserveMet,
  minimumNextBid,
  shouldExtend,
} from "@/lib/auction-math";

describe("bid increments", () => {
  it("uses published rupiah bands", () => {
    expect(incrementFor(0)).toBe(25_000);
    expect(incrementFor(900_000)).toBe(25_000);
    expect(incrementFor(1_000_000)).toBe(50_000);
    expect(incrementFor(10_000_000)).toBe(100_000);
    expect(incrementFor(25_000_000)).toBe(250_000);
  });
});

describe("proxy visible price", () => {
  const START = 1_000_000;

  it("shows the start price with no bids or one bid", () => {
    expect(computeVisiblePrice(START, [])).toBe(START);
    expect(
      computeVisiblePrice(START, [{ userId: "a", maxAmount: 5_000_000 }]),
    ).toBe(START);
  });

  it("shows start + one increment when two bidders and the leader's ceiling covers it", () => {
    // Leader 5m, runner 1m → visible = 1m + 50k
    expect(
      computeVisiblePrice(START, [
        { userId: "a", maxAmount: 5_000_000 },
        { userId: "b", maxAmount: 1_000_000 },
      ]),
    ).toBe(1_050_000);
  });

  it("caps the visible price at the winning maximum (hidden ceiling never revealed)", () => {
    // Runner 1.01m + 50k band would be 1.06m, but the winner's ceiling is
    // only 1.03m — that is exactly what shows, never more.
    expect(
      computeVisiblePrice(START, [
        { userId: "a", maxAmount: 1_030_000 },
        { userId: "b", maxAmount: 1_010_000 },
      ]),
    ).toBe(1_030_000);
  });

  it("never exceeds the winning maximum", () => {
    expect(
      computeVisiblePrice(START, [
        { userId: "a", maxAmount: 1_020_000 },
        { userId: "b", maxAmount: 1_000_000 },
      ]),
    ).toBe(1_020_000);
  });

  it("orders bids regardless of insertion order", () => {
    expect(
      computeVisiblePrice(START, [
        { userId: "b", maxAmount: 1_000_000 },
        { userId: "a", maxAmount: 5_000_000 },
      ]),
    ).toBe(1_050_000);
  });
});

describe("reserve", () => {
  it("is met at and above the threshold and hidden when null", () => {
    expect(isReserveMet(3_000_000, 3_000_000)).toBe(true);
    expect(isReserveMet(2_999_999, 3_000_000)).toBe(false);
    expect(isReserveMet(0, null)).toBe(true);
  });
});

describe("minimum next bid", () => {
  it("equals the start price with no bids", () => {
    expect(minimumNextBid(1_000_000, [])).toBe(1_000_000);
  });
  it("is visible price plus increment with bids", () => {
    expect(
      minimumNextBid(1_000_000, [
        { userId: "a", maxAmount: 5_000_000 },
        { userId: "b", maxAmount: 1_000_000 },
      ]),
    ).toBe(1_100_000);
  });
});

describe("anti-snipe extension", () => {
  const end = 1_000_000;
  it("extends for a competing bid inside 120s", () => {
    expect(
      shouldExtend({
        now: end - 60_000,
        endsAt: end,
        wasLeading: false,
        hasOpponent: true,
        extensionSeconds: 120,
      }),
    ).toBe(true);
  });
  it("does not extend for the current leader raising their ceiling", () => {
    expect(
      shouldExtend({
        now: end - 60_000,
        endsAt: end,
        wasLeading: true,
        hasOpponent: true,
        extensionSeconds: 120,
      }),
    ).toBe(false);
  });
  it("does not extend for a sole bidder", () => {
    expect(
      shouldExtend({
        now: end - 10_000,
        endsAt: end,
        wasLeading: false,
        hasOpponent: false,
        extensionSeconds: 120,
      }),
    ).toBe(false);
  });
  it("does not extend outside the final window", () => {
    expect(
      shouldExtend({
        now: end - 300_000,
        endsAt: end,
        wasLeading: false,
        hasOpponent: true,
        extensionSeconds: 120,
      }),
    ).toBe(false);
  });
});
