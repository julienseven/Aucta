import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { LotRow, UserRow } from "@/db/schema";

/* Requires an explicit disposable Postgres (TEST_DATABASE_URL). Skips otherwise so the
   pure unit suite stays hermetic. Verifies that simultaneous proxy bids are
   serialized by SELECT … FOR UPDATE and never corrupt the visible price. */

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const maybe = enabled ? describe : describe.skip;

maybe("concurrent proxy bids (Postgres)", () => {
  let db: typeof import("@/db").db;
  let pool: typeof import("@/db").pool;
  let bidEvents: typeof import("@/db/schema").bidEvents;
  let bids: typeof import("@/db/schema").bids;
  let emailOutbox: typeof import("@/db/schema").emailOutbox;
  let lots: typeof import("@/db/schema").lots;
  let notifications: typeof import("@/db/schema").notifications;
  let users: typeof import("@/db/schema").users;
  let eq: typeof import("drizzle-orm").eq;
  let placeBid: typeof import("@/lib/auctions").placeBid;
  let bidders: UserRow[] = [];
  let lot: LotRow;
  const tag = `test-${randomBytes(4).toString("hex")}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ db, pool } = await import("@/db"));
    ({ bidEvents, bids, emailOutbox, lots, notifications, users } = await import("@/db/schema"));
    ({ eq } = await import("drizzle-orm"));
    ({ placeBid } = await import("@/lib/auctions"));
    bidders = [];
    for (let i = 0; i < 6; i++) {
      const [u] = await db
        .insert(users)
        .values({
          email: `${tag}-${i}@aucta.local`,
          alias: `${tag.slice(-6)}x${i}*${Math.floor(1000 + Math.random() * 9000)}`,
          provider: "test",
        })
        .returning();
      bidders.push(u);
    }

    const [created] = await db
      .insert(lots)
      .values({
        slug: `${tag}-lot`,
        title: "Concurrency test lot",
        category: "watches",
        condition: "Good",
        status: "live",
        stage: "house",
        description: "temporary",
        image: "/images/lots/watch-1.jpg",
        images: ["/images/lots/watch-1.jpg"],
        sellerAlias: "house*0001",
        startAmount: 100_000,
        currentAmount: 100_000,
        startsAt: new Date(Date.now() - 60 * 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
      })
      .returning();
    lot = created;
  });

  afterAll(async () => {
    if (!db) return;
    try {
      if (lot) {
        await db.delete(bidEvents).where(eq(bidEvents.lotId, lot.id));
        await db.delete(bids).where(eq(bids.lotId, lot.id));
        await db.delete(notifications).where(eq(notifications.lotId, lot.id));
        await db.delete(lots).where(eq(lots.id, lot.id));
      }
      for (const u of bidders) {
        await db.delete(notifications).where(eq(notifications.userId, u.id));
        await db.delete(emailOutbox).where(eq(emailOutbox.to, u.email));
        await db.delete(users).where(eq(users.id, u.id));
      }
    } finally {
      await pool.end();
    }
  });

  it(
    "serializes simultaneous top bids and converges on one correct price",
    async () => {
      // Ordered base: 100k → 200k → 400k → 800k.
      const ladder = [100_000, 200_000, 400_000, 800_000];
      for (let i = 0; i < ladder.length; i++) {
        const r = await placeBid(lot.id, bidders[i], ladder[i]);
        expect(r.state.leaderAlias).toBe(bidders[i].alias);
      }

      // The decisive race: 1.55m and 1.60m arrive simultaneously.
      const race = await Promise.allSettled([
        placeBid(lot.id, bidders[5], 1_550_000),
        placeBid(lot.id, bidders[4], 1_600_000),
      ]);
      expect(race.every((r) => r.status === "fulfilled")).toBe(true);

      const finalRows = await db
        .select()
        .from(lots)
        .where(eq(lots.id, lot.id))
        .limit(1);
      const finalLot = finalRows[0];

      // Highest maximum always leads regardless of commit order.
      expect(finalLot.leadingAlias).toBe(bidders[4].alias);
      // Visible price converges: min(1.6m, 1.55m + 50k band) = 1.6m.
      expect(Number(finalLot.currentAmount)).toBe(1_600_000);

      const committed = await db
        .select()
        .from(bids)
        .where(eq(bids.lotId, lot.id));
      expect(committed.length).toBe(6);
      expect(finalLot.bidCount).toBe(6);

      const events = await db
        .select()
        .from(bidEvents)
        .where(eq(bidEvents.lotId, lot.id));
      expect(events.filter((e) => e.type === "bid_placed").length).toBe(6);
    },
    20_000,
  );
});
