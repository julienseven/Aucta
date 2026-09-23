import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  bidEvents,
  lots,
  orders,
  paymentAttempts,
  users,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { canTransition } from "@/lib/order-math";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

type Action = "preparing" | "ship" | "deliver" | "complete";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;

  const rows = await db
    .select({ order: orders, lot: lots })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .where(eq(orders.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (row.order.buyerId !== user.id && row.lot.ownerId !== user.id && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const attempts = await db
    .select()
    .from(paymentAttempts)
    .where(eq(paymentAttempts.orderId, id))
    .orderBy(desc(paymentAttempts.createdAt));

  return NextResponse.json({
    order: {
      ...row.order,
      createdAt: row.order.createdAt.toISOString(),
      paymentExpiresAt: row.order.paymentExpiresAt?.toISOString() ?? null,
      paymentDueAt: row.order.paymentDueAt?.toISOString() ?? null,
      paidAt: row.order.paidAt?.toISOString() ?? null,
      shippedAt: row.order.shippedAt?.toISOString() ?? null,
      deliveredAt: row.order.deliveredAt?.toISOString() ?? null,
      completedAt: row.order.completedAt?.toISOString() ?? null,
    },
    attempts: attempts.map((a) => ({
      id: a.id,
      provider: a.provider,
      method: a.method,
      status: a.status,
      redirectUrl: a.redirectUrl,
      instructions: a.instructions,
      expiresAt: a.expiresAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required.", code: "AUTH" }, { status: 401 });

  const rl = rateLimit(`order:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok)
    return NextResponse.json({ error: "Too many requests.", code: "RATE" }, { status: 429 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "") as Action;
  const tracking = String(body?.trackingNumber ?? "").trim();
  const carrier = String(body?.carrier ?? "").trim();
  const proof = String(body?.shipmentProof ?? "").trim();

  const rows = await db
    .select({ order: orders, lot: lots })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .where(eq(orders.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Order not found.", code: "NOT_FOUND" }, { status: 404 });
  const { order, lot } = row;
  const isAdmin = user.role === "admin";
  const isBuyer = order.buyerId === user.id;
  const isSeller = lot.ownerId === user.id;

  // Resolve target state per action and enforce role + legal transition.
  const guards: Record<Action, { target: string; allow: boolean }> = {
    preparing: { target: "preparing", allow: isSeller || isAdmin },
    ship: { target: "shipped", allow: isSeller || isAdmin },
    // Buyer confirms receipt; seller/admin may also record carrier delivery.
    deliver: { target: "delivered", allow: isBuyer || isSeller || isAdmin },
    complete: { target: "completed", allow: isBuyer || isAdmin },
  };
  const guard = guards[action];
  if (!guard) return NextResponse.json({ error: "Unknown action.", code: "BAD_ACTION" }, { status: 400 });
  if (!guard.allow) return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
  if (!canTransition(order.status, guard.target))
    return NextResponse.json(
      { error: `Can't move from ${order.status} to ${guard.target}.`, code: "STATE" },
      { status: 409 },
    );

  if (action === "preparing") {
    await db
      .update(orders)
      .set({ status: "preparing", preparingAt: new Date() })
      .where(eq(orders.id, id));
    if (order.buyerId)
      await notify({
        userId: order.buyerId,
        type: "payment_confirmed",
        title: `Seller is preparing "${lot.title}"`,
        body: "The seller accepted the order and is packing your lot.",
        link: `/account?tab=orders`,
        lotId: lot.id,
        dedupeKey: `preparing:${order.id}`,
        email: false,
      });
    return NextResponse.json({ ok: true, status: "preparing" });
  }

  if (action === "ship") {
    if (!tracking && !isAdmin)
      return NextResponse.json({ error: "Tracking number required.", code: "TRACKING" }, { status: 400 });
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: "shipped",
          carrierStatus: "in_transit",
          carrier: carrier || order.carrier,
          trackingNumber: tracking || order.trackingNumber,
          shipmentProof: proof || order.shipmentProof,
          dispatchedBy: user.id,
          shippedAt: new Date(),
        })
        .where(eq(orders.id, id));
      await tx.insert(bidEvents).values({
        lotId: lot.id,
        lotSlug: lot.slug,
        type: "order_shipped",
        meta: { carrier, tracking, proof: Boolean(proof) },
      });
    });
    if (order.buyerId)
      await notify({
        userId: order.buyerId,
        type: "shipped",
        title: `"${lot.title}" is on its way`,
        body: tracking
          ? `${carrier ? carrier + " · " : ""}Tracking ${tracking}.`
          : "The seller dispatched your lot.",
        link: `/account?tab=orders`,
        lotId: lot.id,
        dedupeKey: `shipped:${order.id}`,
      });
    return NextResponse.json({ ok: true, status: "shipped" });
  }

  if (action === "deliver") {
    await db
      .update(orders)
      .set({ status: "delivered", carrierStatus: "delivered", deliveredAt: new Date() })
      .where(eq(orders.id, id));
    if (order.buyerId)
      await notify({
        userId: order.buyerId,
        type: "delivered",
        title: `"${lot.title}" marked delivered`,
        body: "Please confirm the lot arrived as described to complete the sale.",
        link: `/account?tab=orders`,
        lotId: lot.id,
        dedupeKey: `delivered:${order.id}`,
        email: false,
      });
    return NextResponse.json({ ok: true, status: "delivered" });
  }

  // complete: buyer release; increments seller's successful-sales metric.
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(orders.id, id));
    await tx.insert(bidEvents).values({
      lotId: lot.id,
      lotSlug: lot.slug,
      type: "order_completed",
      amount: Number(order.hammerAmount),
      meta: { orderNumber: order.number },
    });
    if (lot.ownerId) {
      await tx
        .update(users)
        .set({
          metrics: sql`jsonb_set(
            coalesce(${users.metrics}, '{}'::jsonb),
            '{successfulSales}',
            to_jsonb(coalesce((${users.metrics}->>'successfulSales')::int, 0) + 1)
          )`,
        })
        .where(eq(users.id, lot.ownerId));
    }
  });
  if (lot.ownerId)
    await notify({
      userId: lot.ownerId,
      type: "delivered",
      title: `"${lot.title}" sale completed`,
      body: "The buyer confirmed delivery and the transaction is complete.",
      link: `/account?tab=orders`,
      lotId: lot.id,
      dedupeKey: `completed:${order.id}`,
      email: false,
    });
  return NextResponse.json({ ok: true, status: "completed" });
}
