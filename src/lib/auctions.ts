import "server-only";
import { db } from "@/db";
import {
  bidEvents,
  bids,
  lots,
  watchlist,
  type LotRow,
  type UserRow,
} from "@/db/schema";
import { notify, notifyOutbid, notifyReserveMet } from "@/lib/notifications";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  incrementFor,
  type CategorySlug,
  type LotStatus,
} from "@/lib/config";
import {
  computeVisiblePrice,
  isReserveMet,
  shouldExtend,
} from "@/lib/auction-math";

export type BidState = {
  current: number;
  nextMin: number;
  leaderAlias: string | null;
  bidCount: number;
  reserveMet: boolean;
  increment: number;
};

export function bidStateFor(
  lot: LotRow,
  history: { userId?: string; alias?: string | null; maxAmount: number }[],
): BidState {
  const override = lot.incrementOverride ? Number(lot.incrementOverride) : undefined;

  const ordered = [...history].sort((a, b) => b.maxAmount - a.maxAmount);
  const competitivePrice = computeVisiblePrice(
    Number(lot.startAmount),
    ordered.map((h) => ({ userId: h.userId, maxAmount: h.maxAmount })),
    override,
  );
  const reserveFloor = lot.reserveAmount == null || !ordered.length
    ? 0
    : Math.min(Number(lot.reserveAmount), ordered[0].maxAmount);
  const current = Math.max(Number(lot.startAmount), Number(lot.currentAmount), competitivePrice, reserveFloor);
  const leaderAlias: string | null =
    ordered[0]?.alias ?? lot.leadingAlias ?? null;
  const bidCount = lot.bidCount;

  const reserveMet = isReserveMet(current, lot.reserveAmount ? Number(lot.reserveAmount) : null);
  return {
    current,
    nextMin: ordered.length ? current + (override ?? incrementFor(current)) : current,
    leaderAlias,
    bidCount,
    reserveMet,
    increment: override ?? incrementFor(current),
  };
}

export type BidErrorCode =
  | "NOT_FOUND"
  | "NOT_OPEN"
  | "CLOSED"
  | "NOT_WHOLE"
  | "DECIMALS"
  | "TOO_LOW"
  | "RAISE_LOW"
  | "SELF_BID";

export class BidError extends Error {
  status: number;
  code: BidErrorCode;
  meta?: { amount?: number };
  constructor(
    status: number,
    code: BidErrorCode,
    message: string,
    meta?: { amount?: number },
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

/* Place (or raise) a proxy bid. The server decides the visible price. */
export async function placeBid(
  lotId: string,
  user: UserRow,
  rawMax: number,
): Promise<{ state: BidState; extended: boolean; raised: boolean; endsAt: Date }> {
  const result = await db.transaction(async (tx) => {
    const lotRows = await tx
      .select()
      .from(lots)
      .where(eq(lots.id, lotId))
      .for("update");
    const lot = lotRows[0];
    if (!lot) throw new BidError(404, "NOT_FOUND", "This lot could not be found.");

    // Marketplace integrity: consignors can never bid on their own lots.
    if (lot.ownerId && lot.ownerId === user.id)
      throw new BidError(403, "SELF_BID", "Sellers cannot bid on their own lots.");

    // Use the database clock after taking the lot lock so bid eligibility is
    // consistent with scheduler queries, even when app hosts have clock skew.
    const [{ now }] = await tx
      .select({ now: sql<Date>`clock_timestamp()` })
      .from(lots)
      .where(eq(lots.id, lot.id))
      .limit(1);
    const nowMs = now.getTime();
    if (new Date(lot.startsAt).getTime() > nowMs)
      throw new BidError(409, "NOT_OPEN", "This auction has not opened yet.");
    if (lot.status !== "live" || new Date(lot.endsAt).getTime() <= nowMs)
      throw new BidError(409, "CLOSED", "This auction is already closed.");

    const max = Math.floor(rawMax);
    if (!Number.isSafeInteger(max) || max <= 0)
      throw new BidError(400, "NOT_WHOLE", "Enter a whole rupiah amount.");
    if (!Number.isInteger(rawMax))
      throw new BidError(400, "DECIMALS", "Bids must be whole rupiah, no decimals.");

    const historyRows = await tx
      .select({
        userId: bids.userId,
        alias: bids.alias,
        maxAmount: bids.maxAmount,
        createdAt: bids.createdAt,
      })
      .from(bids)
      .where(eq(bids.lotId, lot.id))
      .orderBy(desc(bids.maxAmount), asc(bids.createdAt), asc(bids.id));

    const myExisting = historyRows.find(
      (b) => b.userId === user.id,
    );
    const topOther = historyRows.find((b) => b.userId !== user.id);
    const state = bidStateFor(lot, historyRows);

    if (myExisting && max <= myExisting.maxAmount) {
      throw new BidError(
        400,
        "RAISE_LOW",
        "Your maximum must be higher than your existing maximum.",
        { amount: Number(myExisting.maxAmount) },
      );
    }
    if (!myExisting && max < state.nextMin) {
      throw new BidError(
        400,
        "TOO_LOW",
        "The next acceptable bid has not been met.",
        { amount: state.nextMin },
      );
    }

    let extended = false;
    const currentEnd = new Date(lot.endsAt).getTime();
    const wasLeading = historyRows[0]?.userId === user.id;
    const reserveWasMet =
      lot.reserveAmount == null ||
      Number(lot.currentAmount) >= Number(lot.reserveAmount);
    /* A qualifying competitive bid inside the final 120s extends the clock.
       Raising a ceiling while already leading does not, and a sole bidder
       cannot trigger an extension against nobody. */
    extended = shouldExtend({
      now: nowMs,
      endsAt: currentEnd,
      wasLeading,
      hasOpponent: Boolean(topOther),
      extensionSeconds: 120,
    });

    // The lot lock serializes priorities, including bids in the same millisecond.
    const priorityAt = new Date(Math.max(nowMs, ...historyRows.map((b) => b.createdAt.getTime() + 1)));
    if (myExisting) {
      await tx
        .update(bids)
        .set({ maxAmount: max, createdAt: priorityAt })
        .where(and(eq(bids.lotId, lot.id), eq(bids.userId, user.id)));
    } else {
      await tx.insert(bids).values({
        lotId: lot.id,
        userId: user.id,
        alias: user.alias,
        maxAmount: max,
        createdAt: priorityAt,
      });
    }

    const refreshedHistory = [
      ...historyRows
        .filter((b) => b.userId !== user.id)
        .map((b) => ({
          userId: b.userId,
          alias: b.alias,
          maxAmount: b.maxAmount,
        })),
      { userId: user.id, alias: user.alias, maxAmount: max },
    ];
    const nextState = bidStateFor(
      { ...lot, bidCount: lot.bidCount + (myExisting ? 0 : 1) },
      refreshedHistory,
    );
    const newLeader = nextState.leaderAlias;
    const newBidCount = lot.bidCount + (myExisting ? 0 : 1);

    await tx
      .update(lots)
      .set({
        currentAmount: nextState.current,
        leadingAlias: newLeader,
        bidCount: newBidCount,
        endsAt: extended ? new Date(currentEnd + 120_000) : lot.endsAt,
      })
      .where(eq(lots.id, lot.id));

    /* Immutable lifecycle events — append only, never rewritten. */
    await tx.insert(bidEvents).values({
      lotId: lot.id,
      lotSlug: lot.slug,
      userId: user.id,
      alias: user.alias,
      type: "bid_placed",
      amount: max,
      meta: {
        visiblePrice: nextState.current,
        leading: newLeader === user.alias,
        raised: Boolean(myExisting),
      },
    });
    if (extended) {
      await tx.insert(bidEvents).values({
        lotId: lot.id,
        lotSlug: lot.slug,
        userId: user.id,
        alias: user.alias,
        type: "proxy_extended",
        amount: max,
        meta: { seconds: 120 },
      });
    }

    return {
      state: { ...nextState, bidCount: newBidCount },
      extended,
      raised: Boolean(myExisting),
      endsAt: extended ? new Date(currentEnd + 120_000) : new Date(lot.endsAt),
      outbidUserId:
        newLeader === user.alias &&
        historyRows[0] &&
        historyRows[0].userId !== user.id
          ? historyRows[0].userId
          : null,
      reserveCrossed: !reserveWasMet && nextState.reserveMet,
      firstBid: newBidCount === 1,
      lotForNotify: lot,
      leaderAlias: newLeader,
    };
  });

  /* ---------------- after commit: notifications ---------------- */
  const committedLot = result.lotForNotify as LotRow;
  const refreshedLot = {
    ...committedLot,
    currentAmount: result.state.current,
    leadingAlias: result.leaderAlias,
  };
  if (result.outbidUserId) {
    await notifyOutbid(refreshedLot, [result.outbidUserId], user.alias);
  }
  if (result.reserveCrossed) {
    const watchers = await db
      .select({ userId: watchlist.userId })
      .from(watchlist)
      .where(eq(watchlist.lotId, lotId));
    await notifyReserveMet(
      refreshedLot,
      watchers.map((w) => w.userId).filter((id): id is string => Boolean(id)),
    );
  }
  if (result.firstBid && committedLot.ownerId) {
    await notify({
      userId: committedLot.ownerId,
      type: "seller_new_bid",
      title: `First bid on "${committedLot.title}"`,
      body: `Bidding has opened at ${Intl.NumberFormat("en-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(result.state.current)}.`,
      link: `/auctions/${committedLot.slug}`,
      lotId: committedLot.id,
      dedupeKey: `firstbid:${committedLot.id}`,
      email: false,
    });
  }

  return result;
}

/* ----------------------- Catalogue queries ----------------------- */

export type CatalogueFilters = {
  status?: string;
  category?: string;
  condition?: string;
  q?: string;
  min?: number;
  max?: number;
  sort?: string;
};

export async function queryLots(filters: CatalogueFilters): Promise<LotRow[]> {
  const conds = [];

  if (filters.status && filters.status !== "open") {
    conds.push(eq(lots.status, filters.status as LotStatus));
  } else if (filters.status === "open" || !filters.status) {
    // Live and upcoming are the default open floor.
    conds.push(sql`${lots.status} IN ('live','upcoming')`);
  }
  if (filters.category) {
    conds.push(eq(lots.category, filters.category as CategorySlug));
  }
  if (filters.condition) {
    conds.push(eq(lots.condition, filters.condition));
  }
  if (filters.q) {
    conds.push(
      sql`(${lots.title} ILIKE ${`%${filters.q}%`} OR ${lots.description} ILIKE ${`%${filters.q}%`})`,
    );
  }
  if (filters.min != null) conds.push(gte(lots.currentAmount, filters.min));
  if (filters.max != null) conds.push(lte(lots.currentAmount, filters.max));

  const isSoldMode = filters.status === "sold";
  const order =
    filters.sort === "newest"
      ? [desc(lots.createdAt)]
      : filters.sort === "watched"
        ? [desc(lots.watchCount)]
        : filters.sort === "price-asc"
          ? [asc(lots.currentAmount)]
          : filters.sort === "price-desc"
            ? [desc(lots.currentAmount)]
            : // ending soon: open lots end asc; the archive shows newest sales first
              isSoldMode
                ? [desc(lots.endsAt)]
                : [asc(lots.endsAt)];

  return db
    .select()
    .from(lots)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...order);
}

export async function getLotBySlug(slug: string): Promise<LotRow | null> {
  const rows = await db.select().from(lots).where(eq(lots.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getBidHistory(lotId: string) {
  return db
    .select({
      id: bids.id,
      alias: bids.alias,
      maxAmount: bids.maxAmount,
      createdAt: bids.createdAt,
      userId: bids.userId,
    })
    .from(bids)
    .where(eq(bids.lotId, lotId))
    .orderBy(desc(bids.createdAt))
    .limit(24);
}

export async function getWatchIds(userId: string): Promise<string[]> {
  const rows = await db.select({ lotId: watchlist.lotId }).from(watchlist).where(eq(watchlist.userId, userId));
  return rows.map((r) => r.lotId);
}

export async function getWatchlistLots(userId: string): Promise<LotRow[]> {
  return db
    .select({ lot: lots })
    .from(watchlist)
    .innerJoin(lots, eq(watchlist.lotId, lots.id))
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt))
    .then((rows) => rows.map((r) => r.lot as unknown as LotRow));
}
