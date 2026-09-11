export const AUCTION_STATES = [
  "DRAFT", "PENDING_REVIEW", "SCHEDULED", "LIVE", "ENDED", "AWAITING_PAYMENT",
  "PAID", "FULFILLMENT", "COMPLETED", "REJECTED", "CANCELLED", "NO_SALE",
  "PAYMENT_FAILED", "DISPUTED", "REFUNDED",
] as const;

export type AuctionState = typeof AUCTION_STATES[number];

const transitions: Record<AuctionState, readonly AuctionState[]> = {
  DRAFT: ["PENDING_REVIEW", "CANCELLED"],
  PENDING_REVIEW: ["SCHEDULED", "LIVE", "REJECTED", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  SCHEDULED: ["LIVE", "CANCELLED"],
  LIVE: ["ENDED", "CANCELLED"],
  ENDED: ["AWAITING_PAYMENT", "NO_SALE"],
  AWAITING_PAYMENT: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAID: ["FULFILLMENT", "DISPUTED"],
  FULFILLMENT: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: ["REFUNDED", "PAID", "FULFILLMENT", "COMPLETED"],
  CANCELLED: [],
  NO_SALE: [],
  PAYMENT_FAILED: [],
  REFUNDED: [],
};

/** Reference lifecycle only. Authentication, dispute windows and prerequisites are SQL authority. */
export function canTransition(from: AuctionState, to: AuctionState): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: AuctionState, to: AuctionState): void {
  if (!canTransition(from, to)) throw new Error(`Illegal auction transition: ${from} → ${to}.`);
}
