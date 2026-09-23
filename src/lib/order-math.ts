/* Framework-free order & fee math — pure functions, fully unit-tested.
   Whole IDR only. This is a marketplace payment layer, not escrow: funds
   settle to the seller per the gateway payout, and AUCTA records the fee. */

export const SELLER_COMMISSION_BPS = Number(
  process.env.SELLER_COMMISSION_BPS ?? 700,
); // 7%
export const BUYER_FEE_BPS = Number(process.env.BUYER_FEE_BPS ?? 0);
export const PAYMENT_WINDOW_HOURS = Number(
  process.env.PAYMENT_WINDOW_HOURS ?? 24,
);
export const DISPATCH_WINDOW_HOURS = Number(
  process.env.DISPATCH_WINDOW_HOURS ?? 48,
);

export function bps(amount: number, points: number): number {
  return Math.round((amount * points) / 10_000);
}

export type OrderMoney = {
  hammer: number;
  shipping: number;
};

export type OrderTotals = {
  hammer: number;
  shipping: number;
  buyerFee: number;
  sellerFee: number;
  amountDue: number;
  sellerPayout: number;
};

export function computeOrderTotals(input: OrderMoney): OrderTotals {
  const buyerFee = bps(input.hammer, BUYER_FEE_BPS);
  const sellerFee = bps(input.hammer, SELLER_COMMISSION_BPS);
  const amountDue = input.hammer + input.shipping + buyerFee;
  const sellerPayout = input.hammer - sellerFee;
  return {
    hammer: input.hammer,
    shipping: input.shipping,
    buyerFee,
    sellerFee,
    amountDue,
    sellerPayout,
  };
}

/* Buyer-selectable shipping options derived from the seller's quote.
   In-person collection is always free; express is a multiple of standard. */
export type ShippingOption = {
  id: "pickup" | "standard" | "express";
  label: string;
  cost: number;
  eta: string;
};

export function shippingOptions(standardQuote: number): ShippingOption[] {
  const quote = Math.max(0, Math.round(standardQuote));
  return [
    {
      id: "standard",
      label: "Courier — standard (JNE REG / J&T / SiCepat)",
      cost: quote,
      eta: "2–4 working days after dispatch",
    },
    {
      id: "express",
      label: "Courier — express (JNE YES / Sameday)",
      cost: Math.round(quote * 1.7),
      eta: "Next-day in major cities after dispatch",
    },
    {
      id: "pickup",
      label: "In-person collection",
      cost: 0,
      eta: "Arrange directly with the seller",
    },
  ];
}

export function shippingCostFor(
  standardQuote: number,
  option: string,
): number {
  const opts = shippingOptions(standardQuote);
  return opts.find((o) => o.id === option)?.cost ?? standardQuote;
}

export const ORDER_STATUSES = [
  "awaiting_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "completed",
  "payment_failed",
  "cancelled",
  "disputed",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/* Allowed forward transitions. Refunded/cancelled are terminal. */
const TRANSITIONS: Record<string, string[]> = {
  awaiting_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["cancelled"],
  paid: ["preparing", "refunded", "disputed", "cancelled"],
  preparing: ["shipped", "refunded", "disputed"],
  shipped: ["delivered", "disputed"],
  delivered: ["completed", "disputed"],
  completed: ["refunded", "disputed"],
  disputed: ["preparing", "shipped", "completed", "refunded", "cancelled"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function orderNumber(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = randomBase36(6).toUpperCase();
  return `AUCT-${y}${m}${d}-${rand}`;
}

function randomBase36(n: number): string {
  let out = "";
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const { randomInt } = require("node:crypto") as typeof import("node:crypto");
  for (let i = 0; i < n; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}
