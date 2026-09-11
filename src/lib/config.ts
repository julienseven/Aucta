/** Whole-IDR, versioned marketplace policy. SQL snapshots these values at settlement. */
export const MARKETPLACE_CONFIG = Object.freeze({
  currency: "IDR" as const,
  locale: "id-ID",
  supportedLanguages: ["en", "id"] as const,
  timeZone: "Asia/Jakarta",
  maxIDR: 9_000_000_000_000,
  sellerFeeBps: 700,
  buyerFeeBps: 0,
  extensionWindowMs: 120_000,
  extensionDurationMs: 120_000,
  paymentWindowMs: 86_400_000,
  disputeWindowMs: 2 * 86_400_000,
  increments: [
    { below: 1_000_000, amount: 25_000 },
    { below: 5_000_000, amount: 50_000 },
    { below: 20_000_000, amount: 100_000 },
    { below: Number.POSITIVE_INFINITY, amount: 250_000 },
  ] as const,
});

export const MAX_IDR = MARKETPLACE_CONFIG.maxIDR;
