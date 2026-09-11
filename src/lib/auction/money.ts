import { MARKETPLACE_CONFIG, MAX_IDR } from "../config";

export function assertIDR(amount: number, name = "Amount", allowZero = true): void {
  if (!Number.isSafeInteger(amount) || amount < (allowZero ? 0 : 1) || amount > MAX_IDR) {
    throw new RangeError(`${name} must be a ${allowZero ? "non-negative" : "positive"} whole IDR integer no greater than ${MAX_IDR}.`);
  }
}

const rupiah = new Intl.NumberFormat(MARKETPLACE_CONFIG.locale, { maximumFractionDigits: 0 });

export function formatIDR(amount: number): string {
  assertIDR(amount);
  return `Rp ${rupiah.format(amount)}`;
}

/** Accept plain digits or correctly grouped Indonesian thousands, never decimals. */
export function parseIDR(input: string): number {
  const normalized = input.trim().replace(/^Rp\s*/i, "");
  if (!/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(normalized)) {
    throw new RangeError("Enter a whole IDR amount, for example 1250000 or 1.250.000.");
  }
  const amount = Number(normalized.replaceAll(".", ""));
  assertIDR(amount);
  return amount;
}

export function incrementFor(amount: number, override?: number | null): number {
  assertIDR(amount);
  if (override != null) {
    assertIDR(override, "Bid increment", false);
    return override;
  }
  return MARKETPLACE_CONFIG.increments.find((tier) => amount < tier.below)!.amount;
}

export interface FeePolicy {
  sellerFeeBps: number;
  buyerFeeBps: number;
}

function assertBps(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new RangeError("Fee basis points must be an integer from 0 to 10000.");
  }
}

/** Half-up whole-IDR rounding; BigInt avoids multiplying safe inputs into unsafe floats. */
export function feeFor(amount: number, basisPoints: number): number {
  assertIDR(amount);
  assertBps(basisPoints);
  return Number((BigInt(amount) * BigInt(basisPoints) + 5_000n) / 10_000n);
}

export function calculateFees(hammerPrice: number, shippingAmount = 0, policy: FeePolicy = MARKETPLACE_CONFIG) {
  assertIDR(hammerPrice, "Hammer price");
  assertIDR(shippingAmount, "Shipping");
  const sellerFee = feeFor(hammerPrice, policy.sellerFeeBps);
  const buyerFee = feeFor(hammerPrice, policy.buyerFeeBps);
  const buyerTotal = hammerPrice + buyerFee + shippingAmount;
  const sellerProceeds = hammerPrice - sellerFee + shippingAmount;
  assertIDR(buyerTotal, "Buyer total");
  assertIDR(sellerProceeds, "Seller proceeds");
  return { currency: "IDR" as const, hammerPrice, shippingAmount, sellerFee, buyerFee, buyerTotal, sellerProceeds, sellerFeeBps: policy.sellerFeeBps, buyerFeeBps: policy.buyerFeeBps };
}

export type FeeSnapshot = ReturnType<typeof calculateFees>;
