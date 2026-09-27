import "server-only";
import { db } from "@/db";
import { bidEvents, lots, orders, paymentAttempts } from "@/db/schema";
import { and, asc, desc, eq, inArray, lte, ne, notExists } from "drizzle-orm";
import { canTransition } from "@/lib/order-math";
import { notify } from "@/lib/notifications";
import { logger } from "@/lib/logger";

export type Settlement = {
  orderNumber: string;
  provider: string;
  providerRef?: string;
  method?: string;
  amount: number;
  signatureVerified?: boolean;
  raw?: Record<string, unknown>;
};

/* Idempotent settlement: called from webhooks or the fallback verifier.
   Row locks + status checks guarantee a double-delivered callback cannot
   mark the order paid twice. */
export async function confirmSettlement(
  s: Settlement,
): Promise<{ ok: boolean; reason?: string }> {
  return db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.number, s.orderNumber))
      .for("update")
      .limit(1);
    const order = orderRows[0];
    if (!order) return { ok: false, reason: "ORDER_NOT_FOUND" };

    // Already settled — swallow the duplicate delivery.
    if (
      ["paid", "preparing", "shipped", "delivered", "completed"].includes(
        order.status,
      )
    ) {
      return { ok: true, reason: "ALREADY_PAID" };
    }
    if (order.status === "cancelled" || order.status === "refunded") {
      return { ok: false, reason: "ORDER_TERMINAL" };
    }
    if (order.status !== "awaiting_payment")
      return { ok: false, reason: "INVALID_STATE" };

    // Server-side amount verification: never accept an underpayment silently.
    if (!Number.isSafeInteger(s.amount) || Number(order.amountDue) !== s.amount) {
      logger.warn("payment_amount_mismatch", {
        order: s.orderNumber,
        due: order.amountDue,
        got: s.amount,
      });
      return { ok: false, reason: "AMOUNT_MISMATCH" };
    }

    const [attempt] = await tx.select().from(paymentAttempts)
      .where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.provider, s.provider)))
      .orderBy(desc(paymentAttempts.createdAt)).limit(1);
    if (!attempt || !["pending", "failed"].includes(attempt.status) ||
        attempt.providerRef !== s.orderNumber || attempt.amount !== s.amount ||
        (s.provider === "midtrans" && !s.signatureVerified))
      return { ok: false, reason: "ATTEMPT_MISMATCH" };

    await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        preparingAt: new Date(),
        statusReason: null,
        paymentProvider: s.provider,
        paymentRef: s.providerRef ?? null,
        paymentMethod: s.method ?? null,
        paidAmount: s.amount,
      })
      .where(eq(orders.id, order.id));

    // Record/verify the gateway attempt.
    await tx
      .update(paymentAttempts)
      .set({
        status: "paid",
        signatureVerified: Boolean(s.signatureVerified),
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentAttempts.id, attempt.id));

    // Notifications are queued after commit; return ids and the caller fires them.
    await tx.insert(bidEvents).values({
      lotId: order.lotId,
      type: "order_paid",
      amount: s.amount,
      meta: { orderNumber: order.number, provider: s.provider },
    });

    return { ok: true, sellerId: order.sellerId, buyerId: order.buyerId };
  }).then(async (res) => {
    if (res.ok && "sellerId" in res && res.sellerId) {
      const order = await db.select().from(orders).where(eq(orders.number, s.orderNumber)).limit(1);
      const o = order[0];
      if (o) {
        if (o.sellerId) {
          await notify({
            userId: o.sellerId,
            type: "payment_confirmed",
            title: `Payment confirmed for "${o.lotTitle}"`,
            body: `The buyer settled ${Intl.NumberFormat("en-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
              Number(o.amountDue),
            )}. Please prepare and dispatch within 48 hours.`,
            link: `/account?tab=orders`,
            lotId: o.lotId,
            dedupeKey: `paid-seller:${o.id}`,
          });
        }
        if (o.buyerId) {
          await notify({
            userId: o.buyerId,
            type: "payment_confirmed",
            title: "Payment confirmed",
            body: `Your payment for "${o.lotTitle}" is recorded and verified. The seller is preparing your order.`,
            link: `/account?tab=orders`,
            lotId: o.lotId,
            dedupeKey: `paid-buyer:${o.id}`,
            email: false,
          });
        }
      }
    }
    return res;
  });
}

/* Expire orders whose payment window has closed without settlement. */
export async function expireUnpaidOrders(now = new Date()) {
  const due = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "awaiting_payment"),
        lte(orders.paymentExpiresAt, now),
        notExists(db.select({ id: paymentAttempts.id }).from(paymentAttempts).where(and(
          eq(paymentAttempts.orderId, orders.id),
          eq(paymentAttempts.provider, "midtrans"),
          inArray(paymentAttempts.status, ["pending", "paid"]),
        ))),
      ),
    )
    .orderBy(asc(orders.paymentExpiresAt))
    .limit(25);

  let expiredCount = 0;
  for (const order of due) {
    const expired = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(orders)
        .where(eq(orders.id, order.id)).for("update");
      if (!current || current.status !== "awaiting_payment" ||
          !current.paymentExpiresAt || current.paymentExpiresAt.getTime() > now.getTime()) return false;
      const [gatewayAttempt] = await tx.select().from(paymentAttempts)
        .where(and(eq(paymentAttempts.orderId, current.id), eq(paymentAttempts.provider, "midtrans")))
        .orderBy(desc(paymentAttempts.createdAt)).limit(1);
      if (gatewayAttempt && !["expired", "cancelled", "failed"].includes(gatewayAttempt.status))
        return false;
      await tx
        .update(orders)
        .set({
          status: "cancelled",
          cancelledAt: now,
          statusReason: "payment_expired",
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, "awaiting_payment")));
      // The lot reverts to unsold when settlement lapses.
      await tx
        .update(lots)
        .set({ status: "unsold", soldAmount: null })
        .where(eq(lots.id, order.lotId));
      await tx
        .update(paymentAttempts)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.status, "pending")),
        );
      await tx.insert(bidEvents).values({
        lotId: order.lotId,
        type: "order_payment_lapsed",
        amount: Number(order.amountDue),
        meta: { orderNumber: order.number },
      });
      return true;
    });
    if (!expired) continue;
    expiredCount++;

    if (order.buyerId) {
      await notify({
        userId: order.buyerId,
        type: "payment_required",
        title: `"${order.lotTitle}" order cancelled`,
        body: "The payment window closed before settlement, so the lot is a no-sale.",
        link: `/sold`,
        lotId: order.lotId,
        dedupeKey: `lapsed:${order.id}`,
      });
    }
    if (order.sellerId) {
      await notify({
        userId: order.sellerId,
        type: "payment_required",
        title: `"${order.lotTitle}" not paid in time`,
        body: "The winning bid did not settle within 24 hours. The lot is marked unsold.",
        link: `/sell`,
        lotId: order.lotId,
        dedupeKey: `lapsed-seller:${order.id}`,
        email: false,
      });
    }
    logger.warn("order_payment_expired", { order: order.number });
  }
  return expiredCount;
}

export async function markOrderRefunded(
  orderId: string,
  refund: { amount?: number; reason?: string; ref?: string } = {},
) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order) return { ok: false };
    if (!canTransition(order.status, "refunded"))
      return { ok: false, reason: "INVALID_STATE" };
    const amount = refund.amount ?? Number(order.paidAmount);
    if (!Number.isSafeInteger(amount) || amount !== Number(order.paidAmount))
      return { ok: false, reason: "AMOUNT_MISMATCH" };

    await tx.update(orders).set({
      status: "refunded",
      statusReason: null,
      refundedAt: new Date(),
      refundAmount: amount,
      refundReason: refund.reason ?? null,
      refundRef: refund.ref ?? null,
    }).where(eq(orders.id, orderId));
    await tx.update(paymentAttempts)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(and(eq(paymentAttempts.orderId, orderId), ne(paymentAttempts.status, "refunded")));
    return { ok: true, order };
  });
}
