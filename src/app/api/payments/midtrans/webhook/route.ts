import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
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
      await expireUnpaidOrders();
      break;
    case "failed":
      await db
        .update(orders)
        .set({ status: "payment_failed", statusReason: "gateway_denied" })
        .where(eq(orders.id, orderRows[0].id));
      break;
    case "refunded":
      await markOrderRefunded(orderRows[0].id, {
        amount: result.amount,
        ref: result.providerRef,
        reason: "Gateway refund",
      });
      break;
  }

  return NextResponse.json({ ok: true });
}
