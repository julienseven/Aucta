import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  user: null as { id: string; role: string } | null,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: async () => session.user,
}));
vi.mock("@/lib/security", () => ({
  rateLimit: () => ({ ok: true }),
  clientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(async () => undefined),
}));

describe.skipIf(!process.env.TEST_DATABASE_URL)("concurrent order completion (Postgres)", () => {
  let db: typeof import("@/db").db;
  let pool: typeof import("@/db").pool;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let postOrder: typeof import("@/app/api/orders/[id]/route").POST;
  let buyerId = "";
  let sellerId = "";
  let lotId = "";
  let orderId = "";
  const tag = randomBytes(6).toString("hex");

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ db, pool } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
    ({ POST: postOrder } = await import("@/app/api/orders/[id]/route"));

    const [buyer] = await db.insert(schema.users).values({
      email: `completion-buyer-${tag}@test.invalid`,
      alias: `cb${tag}`,
      provider: "test",
    }).returning();
    buyerId = buyer.id;
    const [seller] = await db.insert(schema.users).values({
      email: `completion-seller-${tag}@test.invalid`,
      alias: `cs${tag}`,
      provider: "test",
      metrics: { successfulSales: 4 },
    }).returning();
    sellerId = seller.id;
    const [lot] = await db.insert(schema.lots).values({
      slug: `completion-${tag}`,
      title: "Order completion concurrency test",
      category: "watches",
      condition: "Good",
      status: "sold",
      stage: "house",
      description: "temporary test lot",
      image: "/test.png",
      ownerId: sellerId,
      sellerAlias: seller.alias,
      startAmount: 100_000,
      currentAmount: 100_000,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() - 60_000),
    }).returning();
    lotId = lot.id;
    const [order] = await db.insert(schema.orders).values({
      number: `AUCT-COMPLETE-${tag}`,
      lotId,
      buyerId,
      sellerId,
      buyerAlias: buyer.alias,
      sellerAlias: seller.alias,
      winnerAlias: buyer.alias,
      hammerAmount: 100_000,
      amountDue: 100_000,
      status: "delivered",
      deliveredAt: new Date(),
    }).returning();
    orderId = order.id;
  });

  afterAll(async () => {
    if (!db) return;
    try {
      if (lotId) {
        await db.delete(schema.bidEvents).where(eq(schema.bidEvents.lotId, lotId));
        await db.delete(schema.orders).where(eq(schema.orders.id, orderId));
        await db.delete(schema.lots).where(eq(schema.lots.id, lotId));
      }
      if (buyerId) await db.delete(schema.users).where(eq(schema.users.id, buyerId));
      if (sellerId) await db.delete(schema.users).where(eq(schema.users.id, sellerId));
    } finally {
      await pool.end();
    }
  });

  it("records completion, seller metric, and audit event once for duplicate requests", async () => {
    session.user = { id: buyerId, role: "collector" };
    const request = () => postOrder(
      new Request("http://localhost/api/orders/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      }),
      { params: Promise.resolve({ id: orderId }) },
    );

    const responses = await Promise.all([request(), request()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    const [seller] = await db.select().from(schema.users).where(eq(schema.users.id, sellerId));
    const events = await db.select().from(schema.bidEvents).where(eq(schema.bidEvents.lotId, lotId));
    expect(order.status).toBe("completed");
    expect(seller.metrics?.successfulSales).toBe(5);
    expect(events.filter((event) => event.type === "order_completed")).toHaveLength(1);
  });
});
