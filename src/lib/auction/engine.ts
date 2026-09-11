import { MARKETPLACE_CONFIG, MAX_IDR } from "../config";
import { assertIDR, calculateFees, incrementFor, type FeeSnapshot } from "./money";
import type { AuctionState } from "./states";

export type BidErrorCode = "UNAUTHENTICATED" | "BIDDER_INELIGIBLE" | "SELF_BID" | "NOT_LIVE" | "NOT_STARTED" | "EXPIRED" | "INVALID_AMOUNT" | "BID_TOO_LOW" | "IDEMPOTENCY_CONFLICT" | "INVALID_TIME";

export class BidError extends Error {
  constructor(public readonly code: BidErrorCode, message: string) {
    super(message);
    this.name = "BidError";
  }
}

export interface ProxyBid {
  bidderId: string;
  maximum: number;
  updatedAt: number;
  /** Monotonic database sequence breaks timestamps which compare equal. */
  priority: number;
}

export interface Settlement {
  auctionId: string;
  buyerId: string;
  sellerId: string;
  fees: FeeSnapshot;
  settledAt: number;
  paymentDeadline: number;
}

/** PRIVATE reference state. Never serialize this object to a client. SQL owns real auctions. */
export interface ReferenceAuction {
  id: string;
  sellerId: string;
  status: AuctionState;
  startingPrice: number;
  currentPrice: number;
  reservePrice: number | null;
  incrementOverride: number | null;
  startsAt: number;
  endsAt: number;
  leaderId: string | null;
  reserveMet: boolean;
  bidCount: number;
  version: number;
  nextPriority: number;
  proxies: readonly ProxyBid[];
  requests: Readonly<Record<string, { bidderId: string; maximum: number }>>;
  settlement: Settlement | null;
}

export interface BidRequest {
  bidderId: string | null;
  emailVerified: boolean;
  suspended: boolean;
  maximum: number;
  idempotencyKey: string;
  /** Supplied by a trusted server clock after acquiring its auction lock. */
  now: number;
}

export interface PublicAuctionSnapshot {
  id: string;
  status: AuctionState;
  startingPrice: number;
  currentPrice: number;
  reserveMet: boolean;
  hasReserve: boolean;
  bidCount: number;
  bidderCount: number;
  startsAt: number;
  endsAt: number;
  version: number;
  serverTime: number;
}

export function publicSnapshot(auction: ReferenceAuction, serverTime: number): PublicAuctionSnapshot {
  return {
    id: auction.id, status: auction.status, startingPrice: auction.startingPrice,
    currentPrice: auction.currentPrice, reserveMet: auction.reserveMet,
    hasReserve: auction.reservePrice !== null, bidCount: auction.bidCount,
    bidderCount: auction.proxies.length, startsAt: auction.startsAt,
    endsAt: auction.endsAt, version: auction.version, serverTime,
  };
}

export function createReferenceAuction(input: {
  id: string; sellerId: string; startingPrice: number; startsAt: number; endsAt: number;
  reservePrice?: number | null; incrementOverride?: number | null; status?: AuctionState;
}): ReferenceAuction {
  assertIDR(input.startingPrice, "Starting price", false);
  if (input.reservePrice != null) {
    assertIDR(input.reservePrice, "Reserve price", false);
    if (input.reservePrice < input.startingPrice) throw new RangeError("Reserve cannot be below the starting price.");
  }
  incrementFor(input.startingPrice, input.incrementOverride);
  if (!Number.isSafeInteger(input.startsAt) || !Number.isSafeInteger(input.endsAt) || input.endsAt <= input.startsAt) {
    throw new RangeError("Auction end must be after its start.");
  }
  return {
    ...input, status: input.status ?? "LIVE", currentPrice: input.startingPrice,
    reservePrice: input.reservePrice ?? null, incrementOverride: input.incrementOverride ?? null,
    leaderId: null, reserveMet: input.reservePrice == null, bidCount: 0, version: 0,
    nextPriority: 1, proxies: [], requests: {}, settlement: null,
  };
}

export function minimumBid(auction: ReferenceAuction, bidderId?: string): number {
  const own = auction.proxies.find((proxy) => proxy.bidderId === bidderId);
  if (own && bidderId === auction.leaderId) return own.maximum + 1;
  return auction.proxies.length === 0 ? auction.startingPrice : auction.currentPrice + incrementFor(auction.currentPrice, auction.incrementOverride);
}

export function placeProxyBid(auction: ReferenceAuction, request: BidRequest) {
  if (!request.bidderId) throw new BidError("UNAUTHENTICATED", "Sign in to place a bid.");
  if (!request.emailVerified || request.suspended) throw new BidError("BIDDER_INELIGIBLE", "Your account is not eligible to bid.");
  if (request.bidderId === auction.sellerId) throw new BidError("SELF_BID", "Sellers cannot bid on their own auctions.");
  if (!Number.isSafeInteger(request.now)) throw new BidError("INVALID_TIME", "Invalid server timestamp.");
  if (!Number.isSafeInteger(request.maximum) || request.maximum <= 0 || request.maximum > MAX_IDR) throw new BidError("INVALID_AMOUNT", "Enter a positive whole IDR bid within the supported limit.");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(request.idempotencyKey)) throw new BidError("IDEMPOTENCY_CONFLICT", "A valid bid request key is required.");
  const requestKey = `${request.bidderId}:${request.idempotencyKey}`;
  const previous = auction.requests[requestKey];
  if (previous) {
    if (previous.maximum !== request.maximum) throw new BidError("IDEMPOTENCY_CONFLICT", "This request key was already used for a different bid.");
    return bidResult(auction, request, false, false, true);
  }
  if (auction.status !== "LIVE") throw new BidError("NOT_LIVE", "This auction is not live.");
  if (request.now < auction.startsAt) throw new BidError("NOT_STARTED", "This auction has not started.");
  if (request.now >= auction.endsAt) throw new BidError("EXPIRED", "This auction has ended.");
  if (request.maximum < minimumBid(auction, request.bidderId)) throw new BidError("BID_TOO_LOW", "Your maximum does not meet the minimum acceptable bid.");

  const wasLeading = request.bidderId === auction.leaderId;
  const proxies = auction.proxies.filter((proxy) => proxy.bidderId !== request.bidderId);
  proxies.push({ bidderId: request.bidderId, maximum: request.maximum, updatedAt: request.now, priority: auction.nextPriority });
  proxies.sort((a, b) => b.maximum - a.maximum || a.priority - b.priority);
  const [top, second] = proxies;
  let price = Math.max(auction.startingPrice, auction.currentPrice);
  if (second) price = Math.max(price, Math.min(top.maximum, second.maximum + incrementFor(second.maximum, auction.incrementOverride)));
  const reserveMet = auction.reservePrice === null || top.maximum >= auction.reservePrice;
  if (auction.reservePrice !== null && reserveMet) price = Math.max(price, auction.reservePrice);
  if (price > top.maximum) throw new Error("Auction invariant failed: price exceeds winning maximum.");
  const competitive = !wasLeading;
  const extended = competitive && auction.endsAt - request.now <= MARKETPLACE_CONFIG.extensionWindowMs;
  const updated: ReferenceAuction = {
    ...auction, currentPrice: price, leaderId: top.bidderId, reserveMet, proxies,
    bidCount: auction.bidCount + Number(competitive), version: auction.version + 1,
    nextPriority: auction.nextPriority + 1,
    endsAt: auction.endsAt + (extended ? MARKETPLACE_CONFIG.extensionDurationMs : 0),
    requests: { ...auction.requests, [requestKey]: { bidderId: request.bidderId, maximum: request.maximum } },
  };
  return bidResult(updated, request, extended, competitive, false);
}

function bidResult(auction: ReferenceAuction, request: BidRequest, extended: boolean, competitive: boolean, replayed: boolean) {
  return {
    auction, snapshot: publicSnapshot(auction, request.now), extended, competitive, replayed,
    ownBid: { leading: auction.leaderId === request.bidderId, maximum: auction.proxies.find((proxy) => proxy.bidderId === request.bidderId)?.maximum ?? null },
  };
}

/** Reference settlement is deterministic. Production uses a unique order + the same SQL row lock as bidding. */
export function settleAuction(auction: ReferenceAuction, now: number, shippingAmount = 0): ReferenceAuction {
  if (!Number.isSafeInteger(now)) throw new RangeError("Invalid server timestamp.");
  if (auction.settlement || auction.status === "NO_SALE") return auction;
  if (auction.status !== "LIVE" || now < auction.endsAt) throw new Error("Auction is not eligible for settlement.");
  if (!auction.leaderId || !auction.reserveMet) return { ...auction, status: "NO_SALE", version: auction.version + 1 };
  return {
    ...auction, status: "AWAITING_PAYMENT", version: auction.version + 1,
    settlement: {
      auctionId: auction.id, buyerId: auction.leaderId, sellerId: auction.sellerId,
      fees: calculateFees(auction.currentPrice, shippingAmount), settledAt: now,
      paymentDeadline: now + MARKETPLACE_CONFIG.paymentWindowMs,
    },
  };
}
