import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { confirmSettlement } from "@/lib/payments/confirm";
import { clientIp, rateLimit } from "@/lib/security";
import { isLocalDemo } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/* Fallback settlement verifier.
   Available only when the real gateway is not configured (no MIDTRANS keys),
   or to desk admins. It stands in for the bank settlement callback and still
   runs the same server-side amount + idempotency checks. */
export async function POST(req: Request) {
  if (!isLocalDemo() || process.env.PAYMENT_PROVIDER !== "manual") {
    return NextResponse.json({ error: "Manual payments are disabled." }, { status: 503 });
  }
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const gatewayConfigured = Boolean(process.env.MIDTRANS_SERVER_KEY);
  const isAdmin = user.role === "admin";
  if (gatewayConfigured && !isAdmin) {
    return NextResponse.json({ error: "Use the payment provider." }, { status: 403 });
  }

  const ip = clientIp(req);
  const rl = rateLimit(`payconfirm:${user.id}:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const orderNumber = String(body?.orderNumber ?? "");
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.number, orderNumber))
    .limit(1);
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.buyerId !== user.id && !isAdmin)
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const res = await confirmSettlement({
    orderNumber,
    provider: "manual",
    providerRef: `manual-${orderNumber}`,
    method: String(body?.method ?? "bank_transfer"),
    amount: Number(order.amountDue),
    signatureVerified: false,
    raw: { simulated: true, verifiedBy: user.alias },
  });

  if (!res.ok)
    return NextResponse.json({ error: res.reason ?? "Not confirmed" }, { status: 409 });
  return NextResponse.json({ ok: true, status: "paid" });
}
