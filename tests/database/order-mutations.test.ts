import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, runAsIdentity, runAsService } from "../../src/lib/server/database";

type Db = Awaited<ReturnType<typeof createDatabase>>;

const SELLER = "00000000-0000-0000-0000-000000000001";
const BUYER = "00000000-0000-0000-0000-000000000002";
const RIVAL = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const SHOP = "11111111-0000-0000-0000-000000000001";
const CAT_WATCHES = "c0000000-0000-0000-0000-000000000001";

type Snapshot = {
  id: string;
  status: string;
  total: number | string;
  payment: { provider: string; status: string; amount: number | string } | null;
  shipment: { carrier: string; tracking_number: string; received_at: string | null } | null;
  review: { rating: number; body: string } | null;
};

function asJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

async function rpc<T>(db: Db, userId: string | null, sql: string, params: unknown[] = []): Promise<T> {
  return runAsIdentity(db, userId, async (tx) => {
    const result = await tx.query<{ result: T }>(sql, params);
    return asJson<T>(result.rows[0].result);
  });
}

async function insertLiveAuction(db: Db): Promise<string> {
  const listingId = crypto.randomUUID();
  const auctionId = crypto.randomUUID();
  const slug = `order-lot-${listingId.slice(0, 8)}`;
  await db.db.query(
    `insert into public.listings(id,seller_id,category_id,brand,slug,title,description,condition,sample)
     values($1,$2,$3,'Test',$4,$5,'PGlite order fixture','Good',true)`,
    [listingId, SHOP, CAT_WATCHES, slug, `Order fixture ${slug}`],
  );
  await db.db.query(
    `insert into public.auctions(id,listing_id,state,starts_at,ends_at,starting_price,current_price,shipping_price,sample)
     values($1,$2,'LIVE',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '2 days',1000000,1000000,85000,true)`,
    [auctionId, listingId],
  );
  await db.db.query(`insert into private.auction_rules(auction_id) values($1)`, [auctionId]);
  return auctionId;
}

async function openOrder(db: Db): Promise<string> {
  const auctionId = await insertLiveAuction(db);
  await rpc(db, BUYER, "select public.place_bid(p_auction_id => $1, p_maximum => $2, p_idempotency_key => $3) as result", [
    auctionId,
    2_000_000,
    crypto.randomUUID(),
  ]);
  await db.db.query(`update public.auctions set ends_at=clock_timestamp()-interval '1 second' where id=$1`, [auctionId]);
  await runAsService(db, (tx) => tx.query("select public.settle_due(50)"));
  const row = await db.db.query<{ id: string }>("select id from public.orders where auction_id=$1", [auctionId]);
  expect(row.rows).toHaveLength(1);
  return row.rows[0].id;
}

describe("SQL order transaction loop", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
  }, 60_000);

  afterAll(async () => {
    await db?.db.close();
  });

  it("walks pay → ship → receive → review with payment idempotency", async () => {
    const orderId = await openOrder(db);
    const key = `pay-${orderId.slice(0, 8)}`;
    const paid = await rpc<Snapshot>(db, BUYER, "select public.pay_order($1,$2) as result", [orderId, key]);
    const paidAgain = await rpc<Snapshot>(db, BUYER, "select public.pay_order($1,$2) as result", [orderId, key]);
    expect(paid.status).toBe("PAID");
    expect(paid.payment?.provider).toBe("mock");
    expect(paidAgain.status).toBe("PAID");
    expect(Number(paid.payment?.amount)).toBe(Number(paidAgain.payment?.amount));

    await expect(rpc(db, BUYER, "select public.pay_order($1,$2) as result", [orderId, `${key}-other`])).rejects.toThrow(/already recorded/i);
    await expect(rpc(db, RIVAL, "select public.pay_order($1,$2) as result", [orderId, `rival-${key}`])).rejects.toThrow(/winning buyer|42501|permission/i);
    await expect(rpc(db, SELLER, "select public.pay_order($1,$2) as result", [orderId, `seller-${key}`])).rejects.toThrow(/winning buyer|42501|permission/i);

    await expect(rpc(db, BUYER, "select public.ship_order($1,$2,$3) as result", [orderId, "JNE YES", "JNE12345678"])).rejects.toThrow(/seller/i);

    const shipped = await rpc<Snapshot>(db, SELLER, "select public.ship_order($1,$2,$3) as result", [orderId, "JNE YES", "JNE12345678"]);
    const shippedAgain = await rpc<Snapshot>(db, SELLER, "select public.ship_order($1,$2,$3) as result", [orderId, "JNE YES", "JNE12345678"]);
    expect(shipped.status).toBe("FULFILLMENT");
    expect(shipped.shipment?.tracking_number).toBe("JNE12345678");
    expect(shippedAgain.shipment?.carrier).toBe("JNE YES");
    await expect(rpc(db, SELLER, "select public.ship_order($1,$2,$3) as result", [orderId, "SiCepat REG", "SCI99999999"])).rejects.toThrow(/already has a shipment/i);

    await expect(rpc(db, SELLER, "select public.confirm_received($1) as result", [orderId])).rejects.toThrow(/buyer/i);
    const received = await rpc<Snapshot>(db, BUYER, "select public.confirm_received($1) as result", [orderId]);
    const receivedAgain = await rpc<Snapshot>(db, BUYER, "select public.confirm_received($1) as result", [orderId]);
    expect(received.shipment?.received_at).toBeTruthy();
    expect(receivedAgain.shipment?.received_at).toBeTruthy();
    expect(received.status).toBe("FULFILLMENT");

    const reviewed = await rpc<Snapshot>(db, BUYER, "select public.review_order($1,$2,$3) as result", [orderId, 5, "Packed well and as described."]);
    const reviewedAgain = await rpc<Snapshot>(db, BUYER, "select public.review_order($1,$2,$3) as result", [orderId, 1, "Should not replace."]);
    expect(reviewed.status).toBe("COMPLETED");
    expect(reviewed.review?.rating).toBe(5);
    expect(reviewedAgain.review?.rating).toBe(5);
    expect(reviewedAgain.review?.body).toBe("Packed well and as described.");

    const payout = await db.db.query<{ status: string; amount: string | number }>("select status, amount from public.payouts where order_id=$1", [orderId]);
    expect(payout.rows[0].status).toBe("pending");
    expect(Number(payout.rows[0].amount)).toBeGreaterThan(0);
  }, 60_000);

  it("rejects anonymous payment and does not grant order_snapshot to buyers", async () => {
    const orderId = await openOrder(db);
    await expect(rpc(db, null, "select public.pay_order($1,$2) as result", [orderId, "anon-key-1"])).rejects.toThrow(/sign-in|42501|permission/i);
    await expect(rpc(db, BUYER, "select public.order_snapshot($1) as result", [orderId])).rejects.toThrow(/permission denied/i);
    await expect(rpc(db, ADMIN, "select public.pay_order($1,$2) as result", [orderId, "admin-key1"])).rejects.toThrow(/winning buyer|42501|permission/i);
  }, 60_000);

  it("blocks review before receipt", async () => {
    const orderId = await openOrder(db);
    await rpc(db, BUYER, "select public.pay_order($1,$2) as result", [orderId, `pay-${orderId.slice(0, 8)}`]);
    await rpc(db, SELLER, "select public.ship_order($1,$2,$3) as result", [orderId, "JNE YES", "JNE87654321"]);
    await expect(rpc(db, BUYER, "select public.review_order($1,$2,$3) as result", [orderId, 5, "Too early."])).rejects.toThrow(/confirm receipt/i);
  }, 60_000);

  it("rejects payment after the deadline and shipping before payment", async () => {
    const unpaid = await openOrder(db);
    await expect(rpc(db, SELLER, "select public.ship_order($1,$2,$3) as result", [unpaid, "JNE YES", "JNE00001111"])).rejects.toThrow(/not ready to ship/i);
    await db.db.query("update public.orders set payment_deadline=clock_timestamp()-interval '1 second' where id=$1", [unpaid]);
    await expect(rpc(db, BUYER, "select public.pay_order($1,$2) as result", [unpaid, `late-${unpaid.slice(0, 8)}`])).rejects.toThrow(/deadline/i);

    const paid = await openOrder(db);
    await rpc(db, BUYER, "select public.pay_order($1,$2) as result", [paid, `pay-${paid.slice(0, 8)}`]);
    await expect(rpc(db, SELLER, "select public.ship_order($1,$2,$3) as result", [paid, "JNE", "ab"])).rejects.toThrow(/tracking number/i);
  }, 60_000);
});

describe("hosted payment permissions", () => {
  it("does not let authenticated clients execute the mock payment RPC", async () => {
    const hosted = await createDatabase({ localMockPayments: false });
    try {
      const result = await hosted.db.query<{ allowed: boolean }>(
        "select has_function_privilege('authenticated','public.pay_order(uuid,text)','EXECUTE') as allowed",
      );
      expect(result.rows[0].allowed).toBe(false);
    } finally {
      await hosted.db.close();
    }
  }, 60_000);
});
