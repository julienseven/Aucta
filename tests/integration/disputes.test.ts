import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(!process.env.TEST_DATABASE_URL)("order disputes (Postgres)", () => {
  let db: typeof import("@/db").db;
  let pool: typeof import("@/db").pool;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let and: typeof import("drizzle-orm").and;
  let openOrderDispute: typeof import("@/lib/disputes").openOrderDispute;
  let performAdminAction: typeof import("@/lib/admin").performAdminAction;
  let buyerId = "";
  let sellerId = "";
  let outsiderId = "";
  let admin: import("@/db/schema").UserRow;
  let lotId = "";
  let orderId = "";
  let invalidOrderId = "";
  const resolvedDisputeIds: string[] = [];
  const tag = randomBytes(5).toString("hex");

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3000";
    ({ db, pool } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ eq, and } = await import("drizzle-orm"));
    ({ openOrderDispute } = await import("@/lib/disputes"));
    ({ performAdminAction } = await import("@/lib/admin"));

    const createUser = async (role = "user") => {
      const [user] = await db
        .insert(schema.users)
        .values({
          email: `dispute-${tag}-${role}-${Math.random()}@test.invalid`,
          alias: `dispute${tag}${role}${Math.floor(Math.random() * 1000)}`,
          provider: "test",
          role,
        })
        .returning();
      return user;
    };
    const buyer = await createUser();
    const seller = await createUser("seller");
    const outsider = await createUser();
    admin = await createUser("admin");
    buyerId = buyer.id;
    sellerId = seller.id;
    outsiderId = outsider.id;

    const [lot] = await db
      .insert(schema.lots)
      .values({
        slug: `dispute-${tag}`,
        title: "Dispute test lot",
        category: "watches",
        condition: "Good",
        status: "sold",
        stage: "house",
        description: "temporary",
        image: "/test.png",
        images: ["/test.png"],
        sellerAlias: seller.alias,
        ownerId: seller.id,
        startAmount: 100_000,
        currentAmount: 100_000,
        startsAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() - 60_000),
      })
      .returning();
    lotId = lot.id;

    const [order] = await db
      .insert(schema.orders)
      .values({
        number: `AUCT-DISPUTE-${tag}`,
        lotId,
        buyerId,
        sellerId,
        buyerAlias: buyer.alias,
        sellerAlias: seller.alias,
        winnerAlias: buyer.alias,
        hammerAmount: 100_000,
        amountDue: 100_000,
        status: "paid",
      })
      .returning();
    orderId = order.id;

    const [invalidOrder] = await db
      .insert(schema.orders)
      .values({
        number: `AUCT-DISPUTE-INVALID-${tag}`,
        lotId,
        buyerId,
        sellerId,
        winnerAlias: buyer.alias,
        hammerAmount: 100_000,
        amountDue: 100_000,
        status: "cancelled",
      })
      .returning();
    invalidOrderId = invalidOrder.id;
  });

  afterAll(async () => {
    if (!db) return;
    try {
      if (lotId) {
        await db.delete(schema.notifications).where(eq(schema.notifications.lotId, lotId));
        await db.delete(schema.disputes).where(eq(schema.disputes.lotId, lotId));
        await db.delete(schema.orders).where(and(eq(schema.orders.lotId, lotId), eq(schema.orders.id, orderId)));
        await db.delete(schema.orders).where(eq(schema.orders.id, invalidOrderId));
        for (const disputeId of resolvedDisputeIds)
          await db.delete(schema.adminEvents).where(eq(schema.adminEvents.targetId, disputeId));
        await db.delete(schema.lots).where(eq(schema.lots.id, lotId));
      }
      for (const userId of [buyerId, sellerId, outsiderId, admin?.id].filter(Boolean)) {
        await db.delete(schema.notifications).where(eq(schema.notifications.userId, userId));
        await db.delete(schema.users).where(eq(schema.users.id, userId));
      }
    } finally {
      await pool.end();
    }
  });

  it("rejects unrelated users and mismatched lots without changing the order", async () => {
    const input = {
      orderId,
      lotId,
      openedById: outsiderId,
      openedByAlias: "outsider",
      reason: "item_not_as_described",
      evidence: "",
    };
    expect(await openOrderDispute(input)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(await openOrderDispute({ ...input, openedById: buyerId, lotId: randomUUID() }))
      .toEqual({ ok: false, code: "LOT_MISMATCH" });
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    const rows = await db.select().from(schema.disputes).where(eq(schema.disputes.orderId, orderId));
    expect(order.status).toBe("paid");
    expect(rows).toHaveLength(0);
  });

  it("locks the order, opens only one dispute, and restores the saved state on resolution", async () => {
    const input = {
      orderId,
      lotId,
      openedById: buyerId,
      openedByAlias: "buyer",
      reason: "item_not_as_described",
      evidence: "photo evidence",
    };
    const attempts = await Promise.all([
      openOrderDispute(input),
      openOrderDispute(input),
    ]);
    const created = attempts.find((result) => result.ok);
    expect(created?.ok).toBe(true);
    expect(attempts.filter((result) => !result.ok)).toEqual([
      { ok: false, code: "EXISTS" },
    ]);

    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    const [dispute] = await db.select().from(schema.disputes).where(eq(schema.disputes.orderId, orderId));
    expect(order.status).toBe("disputed");
    expect(dispute.orderStatusBeforeDispute).toBe("paid");

    await performAdminAction(admin, "resolve_dispute", {
      id: String(dispute.id),
      resolution: "Resume from the prior stage.",
    });
    resolvedDisputeIds.push(String(dispute.id));
    const [resumed] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    expect(resumed.status).toBe("paid");

    const [completedOrder] = await db
      .insert(schema.orders)
      .values({
        number: `AUCT-DISPUTE-COMPLETED-${tag}`,
        lotId,
        buyerId,
        sellerId,
        winnerAlias: "buyer",
        hammerAmount: 100_000,
        amountDue: 100_000,
        status: "completed",
      })
      .returning();
    const completedResult = await openOrderDispute({
      ...input,
      orderId: completedOrder.id,
    });
    expect(completedResult.ok).toBe(true);
    const [completedDispute] = await db
      .select()
      .from(schema.disputes)
      .where(eq(schema.disputes.orderId, completedOrder.id));
    await performAdminAction(admin, "resolve_dispute", {
      id: String(completedDispute.id),
    });
    resolvedDisputeIds.push(String(completedDispute.id));
    const [completedResume] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, completedOrder.id));
    expect(completedResume.status).toBe("completed");
  });

  it("does not rewrite a non-disputed order to shipped during resolution", async () => {
    const [dispute] = await db
      .insert(schema.disputes)
      .values({
        orderId: invalidOrderId,
        lotId,
        openedById: buyerId,
        openedByAlias: "buyer",
        reason: "legacy dispute",
      })
      .returning();
    await performAdminAction(admin, "resolve_dispute", { id: String(dispute.id) });
    resolvedDisputeIds.push(String(dispute.id));
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, invalidOrderId));
    expect(order.status).toBe("cancelled");
  });
});
