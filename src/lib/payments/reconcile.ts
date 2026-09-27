import "server-only";
import { db } from "@/db";
import { bidEvents, lots, orders, paymentAttempts } from "@/db/schema";
import { and, asc, eq, lte } from "drizzle-orm";
import { getPaymentProvider } from "@/lib/payments";
import {
  confirmSettlement,
  expireUnpaidOrders,
} from "@/lib/payments/confirm";
import { logger } from "@/lib/logger";

/* Poll the gateway for recently-created, still-pending attempts (webhooks
   can be missed). The manual fallback provider returns null (settlement is
   confirmed through its verification endpoint). */
export async function reconcilePendingPayments(): Promise<number> {
  const provider = getPaymentProvider();
  if (provider.key !== "midtrans" || !provider.getStatus) return 0;

  const attempts = await db
    .select()
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.status, "pending"),
        eq(paymentAttempts.provider, "midtrans"),
      ),
    )
    .orderBy(asc(paymentAttempts.createdAt))
    .limit(25);

  let n = 0;
  for (const attempt of attempts) {
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, attempt.orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order) continue;
    if (order.status !== "awaiting_payment") {
      await db
        .update(paymentAttempts)
        .set({
          status:
            order.status === "cancelled"
              ? "expired"
              : order.status === "refunded"
                ? "refunded"
                : "paid",
          updatedAt: new Date(),
        })
        .where(eq(paymentAttempts.id, attempt.id));
      continue;
    }

    const gateway = await provider.getStatus(order.number);
    if (gateway?.status === "paid") {
      const settled = await confirmSettlement({
        orderNumber: order.number,
        provider: "midtrans",
        providerRef: gateway.providerRef,
        method: gateway.method,
        amount: gateway.amount,
        signatureVerified: gateway.signatureVerified,
      });
      if (settled.ok) n++;
    } else if (gateway?.status === "expired" || gateway?.status === "cancelled") {
      await db.update(paymentAttempts).set({
        status: gateway.status, updatedAt: new Date(),
      }).where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.status, "pending")));
      await expireUnpaidOrders();
    }
  }
  if (n) logger.info("payments_reconciled", { count: n });
  return n;
}

/* Buyer protection: delivered orders auto-complete after 3 days unless a
   dispute is opened, releasing the sale as final. */
export async function autoCompleteDelivered(): Promise<number> {
  const cutoff = new Date(Date.now() - 3 * 24 * 3_600_000);
  const due = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.status, "delivered"), lte(orders.deliveredAt, cutoff)),
    );
  for (const order of due) {
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(orders.id, order.id));
      await tx.insert(bidEvents).values({
        lotId: order.lotId,
        type: "order_completed",
        amount: Number(order.hammerAmount),
        meta: { orderNumber: order.number, auto: true },
      });
    });
    logger.info("order_auto_completed", { order: order.number });
  }
  void lots;
  return due.length;
}
