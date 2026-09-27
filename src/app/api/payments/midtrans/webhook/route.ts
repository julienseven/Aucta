import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, paymentAttempts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPaymentProvider } from "@/lib/payments";
import {
  confirmSettlement,
  markOrderRefunded,
  expireUnpaidOrders,
} from "@/lib/payments/confirm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/* Midtrans HTTP notification. Always 200 for a valid (or ignored) payload so
   the gateway does not retry forever; bad signatures are dropped (401). */
export async function POST(req: Request) {
  const provider = getPaymentProvider();
  if (provider.key !== "midtrans") return NextResponse.json({ ignored: true });

  const result = await provider.parseWebhook(req);
  if (!result) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.number, result.orderNumber))
    .limit(1);
  if (!orderRows[0]) {
    logger.warn("webhook_unknown_order", { order: result.orderNumber });
    return NextResponse.json({ ok: true });
  }
  const order = orderRows[0];
  const [attempt] = await db.select().from(paymentAttempts).where(and(
    eq(paymentAttempts.orderId, order.id),
    eq(paymentAttempts.provider, "midtrans"),
    eq(paymentAttempts.providerRef, result.orderNumber),
  )).limit(1);
  if (!attempt || attempt.amount !== result.amount || order.currency !== "IDR") {
    logger.warn("webhook_attempt_mismatch", { order: result.orderNumber });
    return NextResponse.json({ error: "payment mismatch" }, { status: 409 });
  }

  switch (result.status) {
    case "paid": {
      const res = await confirmSettlement({
        orderNumber: result.orderNumber,
        provider: "midtrans",
        providerRef: result.providerRef,
        method: result.method,
        amount: result.amount,
        signatureVerified: result.signatureVerified,
        raw: result.raw,
      });
      if (!res.ok) logger.warn("webhook_settlement_rejected", { order: result.orderNumber, reason: res.reason });
      break;
    }
    case "expired":
    case "cancelled":
      await db.update(paymentAttempts).set({
        status: result.status, updatedAt: new Date(),
      }).where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.status, "pending")));
      await expireUnpaidOrders();
      break;
    case "failed":
      await db
        .update(paymentAttempts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.status, "pending")));
      break;
    case "refunded":
      if (order.status !== "refunded" &&
          Number(result.raw.refund_amount) === Number(order.paidAmount) &&
          order.paymentRef === String(result.raw.transaction_id ?? "")) {
        await markOrderRefunded(order.id, {
          amount: Number(order.paidAmount),
          ref: result.providerRef,
          reason: "Gateway refund",
        });
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
