import "server-only";
import { db } from "@/db";
import {
  adminEvents,
  bidEvents,
  bids,
  disputes,
  lots,
  orders,
  paymentAttempts,
  reports,
  users,
  type LotRow,
  type UserRow,
} from "@/db/schema";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { hashImages } from "@/lib/seller";
import { matchLotToAlerts } from "@/lib/collector";
import { notify } from "@/lib/notifications";

export function isAdmin(user: UserRow | null): user is UserRow {
  return user?.role === "admin";
}

async function log(
  admin: UserRow,
  action: string,
  targetType: string,
  targetId: string | null,
  reason?: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(adminEvents).values({
    adminId: admin.id,
    adminAlias: admin.alias,
    action,
    targetType,
    targetId,
    reason: reason ?? null,
    meta: meta ?? {},
  });
}

export async function getAdminOverview() {
  const [
    pendingSellers,
    reviewListings,
    liveLots,
    openDisputes,
    openReports,
    failedOrders,
    suspended,
    eventCount,
    recentEvents,
    ordersByStatus,
    stageCounts,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.sellerStatus, "pending")),
    db.select().from(lots).where(eq(lots.stage, "under_review")),
    db
      .select()
      .from(lots)
      .where(
        and(eq(lots.stage, "published"), sql`${lots.status} IN ('live','upcoming','paused')`),
      )
      .orderBy(desc(lots.endsAt)),
    db
      .select()
      .from(disputes)
      .where(eq(disputes.status, "open"))
      .orderBy(desc(disputes.createdAt)),
    db
      .select()
      .from(reports)
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt)),
    db
      .select()
      .from(orders)
      .where(eq(orders.status, "payment_failed"))
      .orderBy(desc(orders.createdAt)),
    db.select().from(users).where(eq(users.suspended, true)),
    db.select({ n: sql<number>`count(*)::int` }).from(bidEvents),
    db
      .select()
      .from(adminEvents)
      .orderBy(desc(adminEvents.createdAt))
      .limit(10),
    db
      .select({ status: orders.status, n: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({ stage: lots.stage, n: sql<number>`count(*)::int` })
      .from(lots)
      .groupBy(lots.stage),
  ]);

  return {
    counts: {
      pendingSellers: pendingSellers.length,
      reviewListings: reviewListings.length,
      liveLots: liveLots.length,
      openDisputes: openDisputes.length,
      openReports: openReports.length,
      failedOrders: failedOrders.length,
      suspended: suspended.length,
      events: eventCount[0]?.n ?? 0,
    },
    queues: {
      pendingSellers,
      reviewListings,
      liveLots,
      openDisputes,
      openReports,
      failedOrders,
      suspended,
    },
    recentEvents,
    ordersByStatus,
    stageCounts,
  };
}

export async function getSuspiciousLots() {
  // Hot, heavily-bid lots and last-second bid activity.
  const hot = await db
    .select()
    .from(lots)
    .where(gt(lots.bidCount, 0))
    .orderBy(desc(lots.bidCount))
    .limit(40);

  const events = await db
    .select({
      id: bidEvents.id,
      lotId: bidEvents.lotId,
      lotSlug: bidEvents.lotSlug,
      alias: bidEvents.alias,
      type: bidEvents.type,
      amount: bidEvents.amount,
      createdAt: bidEvents.createdAt,
      endsAt: lots.endsAt,
      title: lots.title,
    })
    .from(bidEvents)
    .innerJoin(lots, eq(bidEvents.lotId, lots.id))
    .orderBy(desc(bidEvents.createdAt))
    .limit(300);

  const late = events.filter(
    (e) =>
      (e.type === "bid_placed" || e.type === "proxy_extended") &&
      e.endsAt.getTime() - e.createdAt.getTime() <= 120_000,
  );
  const lateLotIds = new Set(late.map((l) => l.lotId));

  const concentration = await Promise.all(
    hot.slice(0, 12).map(async (lot) => {
      const rows = await db
        .select({ alias: bids.alias, n: sql<number>`count(*)::int` })
        .from(bids)
        .where(eq(bids.lotId, lot.id))
        .groupBy(bids.alias);
      const total = rows.reduce((a, r) => a + r.n, 0) || 1;
      const top = rows.sort((a, b) => b.n - a.n)[0];
      return {
        lot,
        share: top ? top.n / total : 0,
        topAlias: top?.alias ?? null,
        totalBids: rows.reduce((a, r) => a + r.n, 0),
        late: lateLotIds.has(lot.id),
      };
    }),
  );

  return {
    flagged: concentration.filter((c) => c.late || (c.share >= 0.6 && c.totalBids >= 4)),
    late,
    events,
  };
}

export async function getLotEvents(lotId: string) {
  return db
    .select()
    .from(bidEvents)
    .where(eq(bidEvents.lotId, lotId))
    .orderBy(desc(bidEvents.createdAt))
    .limit(100);
}

export async function getAllSellers() {
  return db
    .select()
    .from(users)
    .where(sql`${users.role} IN ('seller','admin')`)
    .orderBy(desc(users.createdAt));
}

export async function getAuditLog(limit = 60) {
  return db
    .select()
    .from(adminEvents)
    .orderBy(desc(adminEvents.createdAt))
    .limit(limit);
}

/* ----------------------------- Actions ----------------------------- */

export type AdminAction =
  | "approve_seller"
  | "reject_seller"
  | "approve_listing"
  | "reject_listing"
  | "pause_listing"
  | "resume_listing"
  | "withdraw_listing"
  | "resolve_report"
  | "dismiss_report"
  | "resolve_dispute"
  | "suspend_user"
  | "reinstate_user"
  | "dismiss_payment"
  | "issue_refund";

export async function performAdminAction(
  admin: UserRow,
  action: AdminAction,
  payload: { id: string; reason?: string; resolution?: string },
): Promise<{ ok: true }> {
  const { id, reason, resolution } = payload;

  switch (action) {
    case "approve_seller": {
      await db
        .update(users)
        .set({ sellerStatus: "verified", sellerVerified: true, role: "seller" })
        .where(eq(users.id, id));
      await log(admin, action, "seller", id, reason);
      break;
    }
    case "reject_seller": {
      await db
        .update(users)
        .set({ sellerStatus: "rejected" })
        .where(eq(users.id, id));
      await log(admin, action, "seller", id, reason);
      break;
    }
    case "approve_listing": {
      const [lot] = await db
        .select()
        .from(lots)
        .where(eq(lots.id, id))
        .limit(1);
      if (!lot) throw new Error("Lot not found");
      await db
        .update(lots)
        .set({
          stage: "published",
          status: "upcoming",
          reviewedAt: new Date(),
          reviewedBy: admin.id,
          reviewNote: null,
          imageHashes:
            lot.imageHashes.length > 0 ? lot.imageHashes : hashImages(lot.images),
          startsAt: lot.startsAt,
          endsAt: lot.endsAt,
        })
        .where(eq(lots.id, id));
      if (lot.ownerId) {
        await notify({
          userId: lot.ownerId,
          type: "listing_approved",
          title: `Your listing "${lot.title}" was approved`,
          body: "It is scheduled and will open automatically at its start time.",
          link: `/sell/${lot.id}`,
          lotId: lot.id,
          dedupeKey: `approved:${lot.id}`,
          email: false,
        });
      }
      await matchLotToAlerts(lot).catch(() => undefined);
      await log(admin, action, "lot", id, reason);
      break;
    }
    case "reject_listing": {
      const [lot] = await db.select().from(lots).where(eq(lots.id, id)).limit(1);
      await db
        .update(lots)
        .set({
          stage: "rejected",
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: admin.id,
          reviewNote: reason ?? "Does not meet listing standards.",
        })
        .where(eq(lots.id, id));
      if (lot.ownerId) {
        await notify({
          userId: lot.ownerId,
          type: "listing_rejected",
          title: `Changes requested for "${lot.title}"`,
          body: reason ?? "The desk requested changes before this can be scheduled.",
          link: `/sell/${lot.id}`,
          lotId: lot.id,
          dedupeKey: `rejected:${lot.id}:${Date.now() / 3600000 | 0}`,
          email: false,
        });
      }
      await log(admin, action, "lot", id, reason);
      break;
    }
    case "pause_listing": {
      const [lot] = await db.select().from(lots).where(eq(lots.id, id)).limit(1);
      if (lot) {
        await db
          .update(lots)
          .set({ stage: "paused", status: "paused", reviewNote: reason ?? null })
          .where(eq(lots.id, id));
        await db.insert(bidEvents).values({
          lotId: lot.id,
          lotSlug: lot.slug,
          type: "stage_change",
          meta: { to: "paused", reason },
        });
      }
      await log(admin, action, "lot", id, reason);
      break;
    }
    case "resume_listing": {
      const [lot] = await db.select().from(lots).where(eq(lots.id, id)).limit(1);
      if (lot) {
        const now = Date.now();
        const status =
          new Date(lot.startsAt).getTime() <= now &&
          new Date(lot.endsAt).getTime() > now
            ? "live"
            : "upcoming";
        await db
          .update(lots)
          .set({ stage: "published", status, reviewNote: null })
          .where(eq(lots.id, id));
        await db.insert(bidEvents).values({
          lotId: lot.id,
          lotSlug: lot.slug,
          type: "stage_change",
          meta: { to: status },
        });
      }
      await log(admin, action, "lot", id, reason);
      break;
    }
    case "withdraw_listing": {
      const [lot] = await db.select().from(lots).where(eq(lots.id, id)).limit(1);
      if (lot) {
        await db
          .update(lots)
          .set({ stage: "withdrawn", status: "withdrawn", reviewNote: reason ?? null })
          .where(eq(lots.id, id));
        await db.insert(bidEvents).values({
          lotId: lot.id,
          lotSlug: lot.slug,
          type: "stage_change",
          meta: { to: "withdrawn", reason },
        });
      }
      await log(admin, action, "lot", id, reason);
      break;
    }
    case "resolve_report":
    case "dismiss_report": {
      await db
        .update(reports)
        .set({
          status: action === "resolve_report" ? "resolved" : "dismissed",
          resolution: resolution ?? reason ?? null,
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        })
        .where(eq(reports.id, Number(id)));
      await log(admin, action, "report", id, resolution ?? reason);
      break;
    }
    case "resolve_dispute": {
      const [dispute] = await db
        .select()
        .from(disputes)
        .where(eq(disputes.id, Number(id)))
        .limit(1);
      await db
        .update(disputes)
        .set({
          status: "resolved",
          resolution: resolution ?? reason ?? null,
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        })
        .where(eq(disputes.id, Number(id)));
      if (dispute?.orderId) {
        await db
          .update(orders)
          .set({ status: "shipped" })
          .where(eq(orders.id, dispute.orderId));
      }
      if (dispute?.openedById) {
        await notify({
          userId: dispute.openedById,
          type: "dispute_update",
          title: "Your dispute was resolved",
          body: (resolution ?? reason ?? "The desk closed the dispute."),
          link: "/account?tab=orders",
          lotId: dispute.lotId,
          dedupeKey: `dispute-resolved:${dispute.id}`,
        });
      }
      await log(admin, action, "dispute", id, resolution ?? reason);
      break;
    }
    case "suspend_user": {
      await db
        .update(users)
        .set({ suspended: true, suspendedReason: reason ?? null })
        .where(and(eq(users.id, id), ne(users.role, "admin")));
      await log(admin, action, "seller", id, reason);
      break;
    }
    case "reinstate_user": {
      await db
        .update(users)
        .set({ suspended: false, suspendedReason: null })
        .where(eq(users.id, id));
      await log(admin, action, "seller", id, reason);
      break;
    }
    case "dismiss_payment": {
      await db.transaction(async (tx) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
        if (!order || order.status !== "awaiting_payment")
          throw new Error("Only an unpaid order can be dismissed.");
        const [activeGateway] = await tx.select().from(paymentAttempts).where(and(
          eq(paymentAttempts.orderId, id),
          eq(paymentAttempts.provider, "midtrans"),
          eq(paymentAttempts.status, "pending"),
        )).limit(1);
        if (activeGateway)
          throw new Error("Verify and cancel the pending gateway transaction first.");
        await tx.update(orders).set({
          status: "cancelled", cancelledAt: new Date(),
          statusReason: reason ?? "cancelled by desk",
        }).where(eq(orders.id, id));
        await tx.update(lots).set({ status: "unsold", soldAmount: null })
          .where(eq(lots.id, order.lotId));
      });
      await log(admin, action, "order", id, reason);
      break;
    }
    case "issue_refund": {
      const [ord] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      if (!ord) break;
      if (!ord.paidAmount || !ord.paymentRef ||
          !["paid", "preparing", "shipped", "delivered", "completed", "disputed"].includes(ord.status))
        throw new Error("Order is not eligible for a gateway refund.");
      if (ord.refundRef) break;
      const amount = Number(ord.paidAmount ?? ord.amountDue);
      const { getPaymentProvider } = await import("@/lib/payments");
      const provider = getPaymentProvider();
      if (provider.key !== ord.paymentProvider || !provider.refund ||
          !(await provider.refund(ord.paymentRef, amount)))
        throw new Error("Gateway refund was not accepted.");
      const gatewayRef = `gw:${ord.paymentRef}`;
      await db
        .update(orders)
        .set({
          statusReason: "refund_requested",
          refundRef: gatewayRef,
        })
        .where(eq(orders.id, id));
      await log(admin, action, "order", id, reason, { amount, gatewayRef });
      break;
    }
  }
  return { ok: true };
}

/* Orders with joined lot for the payments queue */
export async function getOrdersList() {
  return db
    .select({
      order: orders,
      title: lots.title,
      slug: lots.slug,
      image: lots.image,
    })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .orderBy(desc(orders.createdAt))
    .limit(60);
}

export async function getReportsWithTargets() {
  const rows = await db
    .select({
      report: reports,
      lotTitle: lots.title,
      lotSlug: lots.slug,
      sellerAlias: users.alias,
    })
    .from(reports)
    .leftJoin(lots, eq(reports.lotId, lots.id))
    .leftJoin(users, eq(reports.sellerId, users.id))
    .orderBy(desc(reports.createdAt))
    .limit(60);
  return rows;
}

export async function getDisputesWithLots() {
  return db
    .select({
      dispute: disputes,
      title: lots.title,
      slug: lots.slug,
      image: lots.image,
      orderNumber: orders.number,
    })
    .from(disputes)
    .innerJoin(lots, eq(disputes.lotId, lots.id))
    .leftJoin(orders, eq(disputes.orderId, orders.id))
    .orderBy(desc(disputes.createdAt))
    .limit(60);
}

export type { LotRow };
