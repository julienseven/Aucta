/* Framework-free auction math. Pure functions only, fully unit-tested. */

export function incrementFor(visiblePrice: number): number {
  if (visiblePrice < 1_000_000) return 25_000;
  if (visiblePrice < 5_000_000) return 50_000;
  if (visiblePrice < 20_000_000) return 100_000;
  return 250_000;
}

export type BidPoint = { userId?: string | null; maxAmount: number };

/* The visible price a proxy auction should show given all maximum bids.
   Rules (eBay-style proxy):
   - no bids            → opening price
   - one bid            → opening price
   - two or more bids   → min(topMax, secondMax + applicable increment)
   The highest bidder leads; their hidden maximum is never shown. */
export function computeVisiblePrice(
  startAmount: number,
  points: BidPoint[],
  overrideIncrement?: number,
): number {
  const ordered = [...points].sort((a, b) => b.maxAmount - a.maxAmount);
  if (ordered.length === 0 || ordered.length === 1) return startAmount;
  const top = ordered[0].maxAmount;
  const second = ordered[1].maxAmount;
  const inc = overrideIncrement ?? incrementFor(second);
  return Math.min(top, second + inc);
}

/* Reserve is met at the visible price (never revealed to bidders). */
export function isReserveMet(
  visiblePrice: number,
  reserveAmount: number | null | undefined,
): boolean {
  if (reserveAmount == null) return true;
  return visiblePrice >= reserveAmount;
}

/* The minimum acceptable *new* bid from someone who has not bid yet. */
export function minimumNextBid(
  startAmount: number,
  points: BidPoint[],
  overrideIncrement?: number,
): number {
  const visible = computeVisiblePrice(startAmount, points, overrideIncrement);
  const ordered = [...points].sort((a, b) => b.maxAmount - a.maxAmount);
  const inc = overrideIncrement ?? incrementFor(visible);
  if (ordered.length === 0) return visible; // start price
  return visible + inc;
}

/* Clamp scheduling window for anti-snipe: competitive late bids add 120s. */
export function shouldExtend(params: {
  now: number;
  endsAt: number;
  wasLeading: boolean;
  hasOpponent: boolean;
  extensionSeconds: number;
}): boolean {
  const { now, endsAt, wasLeading, hasOpponent, extensionSeconds } = params;
  if (wasLeading || !hasOpponent) return false;
  return endsAt - now <= extensionSeconds * 1000;
}
