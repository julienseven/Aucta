import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(!process.env.TEST_DATABASE_URL)("checkout payments (Postgres)", () => {
  let db: typeof import("@/db").db;
  let pool: typeof import("@/db").pool;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let startCheckout: typeof import("@/lib/checkout").startCheckout;
  let confirmSettlement: typeof import("@/lib/payments/confirm").confirmSettlement;
  let expireUnpaidOrders: typeof import("@/lib/payments/confirm").expireUnpaidOrders;
  let markOrderRefunded: typeof import("@/lib/payments/confirm").markOrderRefunded;
  let buyerId = "";
  let lotId = "";
  let orderId = "";
  let expiryOrderId = "";
  let expiryLotId = "";
  let orderNumber = "";
  let paymentDeadline: Date;
  const tag = randomBytes(6).toString("hex");

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.AUCTA_DEMO_MODE = "true";
    process.env.PAYMENT_PROVIDER = "manual";
    process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3000";
    ({ db, pool } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
    ({ startCheckout } = await import("@/lib/checkout"));
    ({ confirmSettlement, expireUnpaidOrders, markOrderRefunded } = await import("@/lib/payments/confirm"));
    const [buyer] = await db.insert(schema.users).values({
      email: `payment-${tag}@test.invalid`, alias: `pay${tag}`, provider: "test",
    }).returning();
    buyerId = buyer.id;
    const [lot] = await db.insert(schema.lots).values({
      slug: `payment-${tag}`, title: "Payment test lot", category: "watches",
      condition: "Good", status: "sold", stage: "house", description: "temporary",
      image: "/test.png", images: ["/test.png"], startAmount: 100_000,
      currentAmount: 100_000, startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() - 60_000),
    }).returning();
    lotId = lot.id;
    orderNumber = `AUCT-TEST-${tag}`;
    paymentDeadline = new Date(Date.now() + 3_600_000);
    const [order] = await db.insert(schema.orders).values({
      number: orderNumber, lotId, buyerId, winnerAlias: buyer.alias,
      hammerAmount: 100_000, shippingCost: 10_000, amountDue: 110_000,
      snapshot: { money: { shipping: 10_000 } },
      paymentExpiresAt: paymentDeadline, paymentDueAt: paymentDeadline,
    }).returning();
    orderId = order.id;
  });

  afterAll(async () => {
    if (!db) return;
    try {
      if (expiryLotId) await db.delete(schema.bidEvents).where(eq(schema.bidEvents.lotId, expiryLotId));
      if (lotId) await db.delete(schema.bidEvents).where(eq(schema.bidEvents.lotId, lotId));
      if (expiryOrderId) await db.delete(schema.orders).where(eq(schema.orders.id, expiryOrderId));
      if (orderId) await db.delete(schema.orders).where(eq(schema.orders.id, orderId));
      if (expiryLotId) await db.delete(schema.lots).where(eq(schema.lots.id, expiryLotId));
      if (lotId) await db.delete(schema.lots).where(eq(schema.lots.id, lotId));
      if (buyerId) await db.delete(schema.users).where(eq(schema.users.id, buyerId));
    } finally {
      await pool.end();
    }
  });

  it("rejects another buyer and reuses one locked payment attempt", async () => {
    const input = {
      buyerId, orderId, shippingOption: "pickup", baseUrl: "http://127.0.0.1:3000",
    };
    await expect(startCheckout({ ...input, buyerId: crypto.randomUUID() }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    const [first, second] = await Promise.all([startCheckout(input), startCheckout(input)]);
    expect(first.attemptId).toBe(second.attemptId);
    const attempts = await db.select().from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.orderId, orderId));
    expect(attempts).toHaveLength(1);
    expect(attempts[0].amount).toBe(100_000);
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(order.paymentExpiresAt).toEqual(paymentDeadline);
    await expect(startCheckout({
      ...input, shippingOption: "standard",
      inlineAddress: { recipientName: "Test", phone: "0800000000", line1: "Test", city: "Jakarta", province: "DKI Jakarta" },
    }))
      .rejects.toMatchObject({ code: "PAYMENT" });
  });

  it("rejects a foreign provider and wrong amount before settling once", async () => {
    expect(await confirmSettlement({ orderNumber, provider: "midtrans", amount: 100_000, signatureVerified: true }))
      .toMatchObject({ ok: false, reason: "ATTEMPT_MISMATCH" });
    expect(await confirmSettlement({ orderNumber, provider: "manual", amount: 99_999 }))
      .toMatchObject({ ok: false, reason: "AMOUNT_MISMATCH" });
    expect(await confirmSettlement({ orderNumber, provider: "manual", amount: 100_000 }))
      .toMatchObject({ ok: true });
    expect(await confirmSettlement({ orderNumber, provider: "manual", amount: 100_000 }))
      .toMatchObject({ ok: true, reason: "ALREADY_PAID" });
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(order.status).toBe("paid");
    const events = await db.select().from(schema.bidEvents).where(eq(schema.bidEvents.lotId, lotId));
    expect(events.filter((event) => event.type === "order_paid")).toHaveLength(1);
  });

  it("keeps a due order open while Midtrans is pending, then expires it after gateway expiry", async () => {
    const [lot] = await db.insert(schema.lots).values({
      slug: `payment-expiry-${tag}`, title: "Expiry test lot", category: "watches",
      condition: "Good", status: "sold", stage: "house", description: "temporary",
      image: "/test.png", images: ["/test.png"], startAmount: 100_000,
      currentAmount: 100_000, startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() - 120_000),
    }).returning();
    expiryLotId = lot.id;
    const number = `AUCT-EXPIRE-${tag}`;
    const [order] = await db.insert(schema.orders).values({
      number, lotId: expiryLotId, winnerAlias: "test",
      hammerAmount: 100_000, amountDue: 100_000,
      paymentExpiresAt: new Date(Date.now() - 60_000),
    }).returning();
    expiryOrderId = order.id;
    const [attempt] = await db.insert(schema.paymentAttempts).values({
      orderId: expiryOrderId, provider: "midtrans", providerRef: number,
      amount: 100_000, status: "pending",
    }).returning();
    await expireUnpaidOrders();
    let [current] = await db.select().from(schema.orders).where(eq(schema.orders.id, expiryOrderId));
    expect(current.status).toBe("awaiting_payment");
    await db.update(schema.paymentAttempts).set({ status: "expired" })
      .where(eq(schema.paymentAttempts.id, attempt.id));
    await expireUnpaidOrders();
    [current] = await db.select().from(schema.orders).where(eq(schema.orders.id, expiryOrderId));
    expect(current.status).toBe("cancelled");
    const [expiredLot] = await db.select().from(schema.lots).where(eq(schema.lots.id, expiryLotId));
    expect(expiredLot.status).toBe("unsold");
  });

  it("records a refund only for the confirmed full payment amount", async () => {
    expect(await markOrderRefunded(orderId, { amount: 50_000 }))
      .toMatchObject({ ok: false, reason: "AMOUNT_MISMATCH" });
    const [before] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(before.status).toBe("paid");
    expect(await markOrderRefunded(orderId, { amount: 100_000, ref: "gateway-refund" }))
      .toMatchObject({ ok: true });
    const [after] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(after.status).toBe("refunded");
  });
});
