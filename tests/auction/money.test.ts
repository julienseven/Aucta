import { describe, expect, it } from "vitest";
import { assertIDR, calculateFees, feeFor, formatIDR, incrementFor, parseIDR } from "../../src/lib/auction/money";
import { MAX_IDR } from "../../src/lib/config";

describe("whole IDR money", () => {
  it.each([[0, "Rp 0"], [12_500_000, "Rp 12.500.000"], [MAX_IDR, "Rp 9.000.000.000.000"]])("formats %s without fractional currency", (amount, expected) => {
    expect(formatIDR(amount as number)).toBe(expected);
  });

  it.each([-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, MAX_IDR + 1, Number.MAX_SAFE_INTEGER + 1])("rejects invalid money %s", (value) => {
    expect(() => assertIDR(value)).toThrow(RangeError);
    expect(() => formatIDR(value)).toThrow(RangeError);
  });

  it.each([["1250000", 1_250_000], ["Rp 1.250.000", 1_250_000], ["  rp 25.000 ", 25_000], ["0", 0]])("parses %s", (input, expected) => {
    expect(parseIDR(input as string)).toBe(expected);
  });

  it.each(["", "1,25", "1.25", "1e6", "0x12", "-100", "+100", "Rp", "1.000.00", "12 500", "9000000000001"]) ("rejects ambiguous or unsafe input %s", (input) => {
    expect(() => parseIDR(input)).toThrow(RangeError);
  });

  it("uses centralized integer half-up fee rounding", () => {
    expect(feeFor(7, 700)).toBe(0);
    expect(feeFor(8, 700)).toBe(1);
    expect(feeFor(50, 100)).toBe(1);
    expect(feeFor(49, 100)).toBe(0);
    expect(feeFor(MAX_IDR, 700)).toBe(630_000_000_000);
  });

  it("snapshots fees once and excludes shipping from fees", () => {
    expect(calculateFees(1_000_000, 25_000)).toEqual({ currency: "IDR", hammerPrice: 1_000_000, shippingAmount: 25_000, sellerFee: 70_000, buyerFee: 0, buyerTotal: 1_025_000, sellerProceeds: 955_000, sellerFeeBps: 700, buyerFeeBps: 0 });
    expect(calculateFees(1_000_000, 25_000, { sellerFeeBps: 500, buyerFeeBps: 100 }).buyerTotal).toBe(1_035_000);
  });

  it.each([-1, 0.5, 10_001, Number.NaN])("rejects invalid basis points %s", (bps) => {
    expect(() => feeFor(1_000_000, bps)).toThrow(RangeError);
  });

  it("rejects unsafe order totals", () => {
    expect(() => calculateFees(MAX_IDR, 1)).toThrow(RangeError);
    expect(() => calculateFees(MAX_IDR, 0, { sellerFeeBps: 700, buyerFeeBps: 1 })).toThrow(RangeError);
  });
});

describe("configurable bid increments", () => {
  it.each([[0, 25_000], [999_999, 25_000], [1_000_000, 50_000], [4_999_999, 50_000], [5_000_000, 100_000], [19_999_999, 100_000], [20_000_000, 250_000], [MAX_IDR, 250_000]])("uses the correct tier at %s", (amount, expected) => {
    expect(incrementFor(amount)).toBe(expected);
  });

  it("uses an auction override at every tier", () => {
    expect(incrementFor(500_000, 5_000)).toBe(5_000);
    expect(incrementFor(25_000_000, 5_000)).toBe(5_000);
    expect(incrementFor(500_000, null)).toBe(25_000);
  });

  it.each([0, -1, 0.1, MAX_IDR + 1])("rejects invalid increment %s", (override) => {
    expect(() => incrementFor(1_000_000, override)).toThrow(RangeError);
  });
});
