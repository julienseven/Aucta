import "server-only";
import { db } from "@/db";
import {
  addresses,
  bidEvents,
  bids,
  followedSellers,
  lots,
  orders,
  users,
  watchlist,
  type LotRow,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { formatRupiah } from "@/lib/format";
import { notify, notifyMany } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import {
  computeOrderTotals,
  orderNumber,
  PAYMENT_WINDOW_HOURS,
  DISPATCH_WINDOW_HOURS,
} from "@/lib/order-math";

export type CloseResult = {
  sold: string[];
  unsold: string[];
};

const CLOSE_BATCH_SIZE = 25;

/* Finalizes one bounded batch of due auctions. Repeated scheduler calls drain
   the backlog. The transaction locks and rechecks each lot before closing. */
export async function processDueCloses(now = new Date()): Promise<CloseResult> {
  const due = await db
    .select()
    .from(lots)
    .where(and(eq(lots.status, "live"), lte(lots.endsAt, now)))
    .orderBy(asc(lots.endsAt), asc(lots.id))
    .limit(CLOSE_BATCH_SIZE);

  const result: CloseResult = { sold: [], unsold: [] };

  for (const lot of due) {
    await db.transaction(async (tx) => {
      // Re-read under lock to guarantee a single finalization.
      const locked = await tx
        .select()
        .from(lots)
        .where(eq(lots.id, lot.id))
        .for("update", { skipLocked: true });
      const current = locked[0];
      if (!current || current.status !== "live" || current.endsAt.getTime() > now.getTime()) return;

      const topBids = await tx
        .select()
        .from(bids)
        .where(eq(bids.lotId, current.id))
        .orderBy(desc(bids.maxAmount), asc(bids.createdAt), asc(bids.id))
        .limit(1);
      const winning = topBids[0];
      const reserveMet =
        current.reserveAmount == null ||
        Number(current.currentAmount) >= Number(current.reserveAmount);

      if (winning && reserveMet) {
        const finalAmount = Number(current.currentAmount);
        const standardShipping = Number(current.shippingCost ?? 0);
        const totals = computeOrderTotals({
          hammer: finalAmount,
          shipping: standardShipping,
        });
        await tx
          .update(lots)
          .set({
            status: "sold",
            soldAmount: finalAmount,
            leadingAlias: winning.alias,
            closedAt: now,
          })
          .where(eq(lots.id, current.id));

        const number = orderNumber(now);
        const sellerRows = current.ownerId
          ? await tx
              .select({ alias: lots.sellerAlias })
              .from(lots)
              .where(eq(lots.id, current.id))
              .limit(1)
          : [];
        const sellerAlias =
          current.sellerAlias ?? sellerRows[0]?.alias ?? "house*0001";

        const snapshot = {
          version: 1,
          closedAt: now.toISOString(),
          lot: {
            id: current.id,
            slug: current.slug,
            title: current.title,
            image: current.image,
            condition: current.condition,
            category: current.category,
          },
          winner: { alias: winning.alias },
          seller: { id: current.ownerId, alias: sellerAlias },
          money: {
            hammer: totals.hammer,
            shipping: totals.shipping,
            buyerFee: totals.buyerFee,
            sellerFee: totals.sellerFee,
            amountDue: totals.amountDue,
            sellerPayout: totals.sellerPayout,
            currency: "IDR",
          },
          note:
            "Immutable receipt generated at the hammer. It is not escrow: funds settle through the payment provider per its payout schedule.",
        };

        const [order] = await tx
          .insert(orders)
          .values({
            number,
            lotId: current.id,
            buyerId: winning.userId,
            sellerId: current.ownerId,
            buyerAlias: winning.alias,
            sellerAlias,
            winnerAlias: winning.alias,
            lotTitle: current.title,
            lotImage: current.image,
            hammerAmount: totals.hammer,
            buyerFeeAmount: totals.buyerFee,
            sellerFeeAmount: totals.sellerFee,
            shippingCost: totals.shipping,
            amountDue: totals.amountDue,
            currency: "IDR",
            snapshot,
            status: "awaiting_payment",
            shippingOption: "standard",
            carrierStatus: "pending",
            paymentExpiresAt: new Date(
              now.getTime() + PAYMENT_WINDOW_HOURS * 3_600_000,
            ),
            paymentDueAt: new Date(
              now.getTime() + PAYMENT_WINDOW_HOURS * 3_600_000,
            ),
            dispatchDueAt: new Date(
              now.getTime() +
                (PAYMENT_WINDOW_HOURS + DISPATCH_WINDOW_HOURS) * 3_600_000,
            ),
          })
          .onConflictDoNothing()
          .returning();

        await tx.insert(bidEvents).values({
          lotId: current.id,
          lotSlug: current.slug,
          bidId: winning.id,
          userId: winning.userId,
          alias: winning.alias,
          type: "auction_won",
          amount: finalAmount,
          meta: { orderNumber: number },
        });

        if (winning.userId && order) {
          await notify({
            userId: winning.userId,
            type: "won",
            title: `You won "${current.title}"`,
            body: `Hammer price ${formatRupiah(finalAmount)}. Please complete payment within 24 hours.`,
            link: `/account?tab=orders`,
            lotId: current.id,
            dedupeKey: `won:${current.id}`,
          });
        }
        result.sold.push(current.slug);
      } else {
        await tx
          .update(lots)
          .set({ status: "unsold", closedAt: now, leadingAlias: winning?.alias ?? null })
          .where(eq(lots.id, current.id));

        await tx.insert(bidEvents).values({
          lotId: current.id,
          lotSlug: current.slug,
          type: "auction_unsold",
          amount: Number(current.currentAmount),
          meta: { reason: winning ? "reserve_not_met" : "no_bids" },
        });

        if (current.ownerId) {
          await notify({
            userId: current.ownerId,
            type: "unsold",
            title: `"${current.title}" ended without a sale`,
            body: winning
              ? "Bidding closed below the reserve, so the lot is a no-sale."
              : "No bids were placed. You can relist from your seller desk.",
            link: "/sell",
            lotId: current.id,
            dedupeKey: `unsold:${current.id}`,
            email: false,
          });
        }
        result.unsold.push(current.slug);
      }
    });
  }

  if (result.sold.length || result.unsold.length) {
    logger.info("auctions_closed", result);
  }
  return result;
}

/* Promotes one bounded batch of scheduled lots when their start hits. */
export async function activateDueStarts(now = new Date()): Promise<LotRow[]> {
  const due = await db
    .select()
    .from(lots)
    .where(
      and(
        eq(lots.stage, "published"),
        eq(lots.status, "upcoming"),
        lte(lots.startsAt, now),
      ),
    )
    .orderBy(asc(lots.startsAt), asc(lots.id))
    .limit(CLOSE_BATCH_SIZE);

  const activated: LotRow[] = [];
  for (const lot of due) {
    const activatedRow = await db
      .update(lots)
      .set({ status: "live" })
      .where(and(eq(lots.id, lot.id), eq(lots.stage, "published"), eq(lots.status, "upcoming"), lte(lots.startsAt, now)))
      .returning({ id: lots.id });
    if (!activatedRow.length) continue;
    activated.push(lot);

    // Saved searches and followed-seller alerts.
    const { matchLotToAlerts } = await import("@/lib/collector");
    await matchLotToAlerts(lot).catch(() => undefined);

    // Notify watchers that the auction has started.
    const watchers = await db
      .select({ userId: watchlist.userId })
      .from(watchlist)
      .where(eq(watchlist.lotId, lot.id));
    await Promise.all(
      watchers.map((w) =>
        notify({
          userId: w.userId,
          type: "auction_starting",
          title: `"${lot.title}" is now open for bidding`,
          body: `Bidding is live from ${formatRupiah(
            Number(lot.startAmount),
          )}. The clock is running.`,
          link: `/auctions/${lot.slug}`,
          lotId: lot.id,
          dedupeKey: `start:${lot.id}`,
        }),
      ),
    );
  }
  if (activated.length) logger.info("auctions_started", { n: activated.length });
  return activated;
}

/* Ending-soon reminders (once per lot, ~60 minutes out). */
export async function sendEndingSoon(now = new Date()): Promise<number> {
  const soon = await db
    .select()
    .from(lots)
    .where(
      and(
        eq(lots.status, "live"),
        lte(lots.endsAt, new Date(now.getTime() + 60 * 60_000)),
        // only notify once: rely on notification dedupe key per lot
      ),
    );

  let sent = 0;
  for (const lot of soon) {
    const watchers = await db
      .select({ userId: watchlist.userId })
      .from(watchlist)
      .where(eq(watchlist.lotId, lot.id));
    // Bidders should also be nudged: include distinct users with bids.
    const bidders = await db
      .select({ userId: bids.userId })
      .from(bids)
      .where(eq(bids.lotId, lot.id));
    const ids = new Set<string>(
      [...watchers, ...bidders].map((w) => w.userId).filter(Boolean) as string[],
    );
    await Promise.all(
      [...ids].map((userId) =>
        notify({
          userId,
          type: "ending_soon",
          title: `"${lot.title}" closes within the hour`,
          body: `Final stretch — current bid ${formatRupiah(
            Number(lot.currentAmount),
          )}. A competitive bid in the last 120 seconds extends the clock.`,
          link: `/auctions/${lot.slug}`,
          lotId: lot.id,
          dedupeKey: `ending:${lot.id}`,
        }),
      ),
    );
    sent += ids.size;
  }
  return sent;
}

/* Seller ship reminders for paid orders not dispatched within 48h. */
export async function sendShipReminders(now = new Date()): Promise<number> {
  const paidOrders = await db
    .select({
      order: orders,
      ownerId: lots.ownerId,
      title: lots.title,
    })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .where(and(eq(orders.status, "paid"), lte(orders.paidAt, new Date(now.getTime() - 48 * 3_600_000))));

  let n = 0;
  for (const { order, ownerId, title } of paidOrders) {
    if (!ownerId || order.shipReminderAt) continue;
    await notify({
      userId: ownerId,
      type: "ship_reminder",
      title: `Reminder: ship "${title}"`,
      body: "Payment is confirmed and 48 hours have passed. Please dispatch the lot and add tracking.",
      link: `/account?tab=orders`,
      lotId: order.lotId,
      dedupeKey: `shipremind:${order.id}`,
      email: false,
    });
    await db
      .update(orders)
      .set({ shipReminderAt: now })
      .where(eq(orders.id, order.id));
    n++;
  }
  return n;
}

void users;
void addresses;
void followedSellers;
void inArray;
void notifyMany;
