import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, runAsIdentity } from "../../src/lib/server/database";

type Db = Awaited<ReturnType<typeof createDatabase>>;
const SELLER = "00000000-0000-0000-0000-000000000001";
const BUYER = "00000000-0000-0000-0000-000000000002";
const RIVAL = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
type Decision = { id: string; status: string; previousStatus: string; resolutionReason: string };

describe("database-authoritative trust and safety", () => {
  let db: Db;
  let listingId: string;
  const rpc = async <T = Decision>(user: string | null, name: string, values: unknown[] = []): Promise<T> =>
    runAsIdentity(db, user, async (tx) => (await tx.query<{ result: T }>(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as result`, values)).rows[0].result);

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
    listingId = (await db.db.query<{ id: string }>("select id from public.listings where slug='seiko-6139-pogue-chronograph'")).rows[0].id;
  }, 60_000);
  afterAll(async () => { await db?.db.close(); });

  async function order(status: "PAID" | "FULFILLMENT" | "AWAITING_PAYMENT" | "COMPLETED") {
    const auctionId = crypto.randomUUID();
    const lotId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    await db.db.query("insert into public.listings(id,seller_id,category_id,slug,title,description,condition,sample) select $1,seller_id,category_id,$2,'Trust fixture','Trust fixture description','Good',true from public.listings where id=$3", [lotId, `trust-${lotId}`, listingId]);
    await db.db.query("insert into public.auctions(id,listing_id,state,starts_at,ends_at,starting_price,current_price,sample) values($1,$2,$3,now()-interval '2 days',now()-interval '1 day',1000000,1000000,true)", [auctionId, lotId, status]);
    await db.db.query("insert into public.orders(id,auction_id,buyer_id,seller_id,status,winning_bid,seller_fee,shipping_amount,total,seller_net,payment_deadline) values($1,$2,$3,$4,$5,1000000,70000,0,1000000,930000,now()+interval '1 day')", [orderId, auctionId, BUYER, SELLER, status]);
    return { orderId, auctionId };
  }

  it("deduplicates reports, restricts review to admin and audits once", async () => {
    const report = await rpc(BUYER, "report_listing", [listingId, "The provenance needs review."]);
    expect((await rpc(BUYER, "report_listing", [listingId, "A repeated submission."])).id).toBe(report.id);
    await expect(rpc(RIVAL, "review_report", [report.id, "reviewed", "Evidence reviewed carefully."])).rejects.toThrow(/Administrator/);
    const reviewed = await rpc(ADMIN, "review_report", [report.id, "reviewed", "Evidence reviewed carefully."]);
    expect(reviewed.status).toBe("reviewed");
    await rpc(ADMIN, "review_report", [report.id, "reviewed", "Evidence reviewed carefully."]);
    expect((await db.db.query("select id from public.admin_actions where subject_id=$1", [report.id])).rows).toHaveLength(1);
    expect((await db.db.query("select id from private.audit_logs where subject_id=$1", [report.id])).rows).toHaveLength(1);
    await expect(rpc(ADMIN, "review_report", [report.id, "dismissed", "Changing final decisions."])).rejects.toThrow(/already/);
  });

  it("rejects invalid and private listing reports and anonymous access", async () => {
    for (const reason of [null, "short", "x".repeat(2001), "Bad\u0001reason text", "Bad\u007freason text"]) {
      await expect(rpc(BUYER, "report_listing", [listingId, reason])).rejects.toThrow(/reason/);
    }
    await expect(rpc(null, "report_listing", [listingId, "Anonymous report attempt."])).rejects.toThrow(/permission/);
    const fixture = await order("PAID");
    await db.db.query("update public.auctions set state='DRAFT' where id=$1", [fixture.auctionId]);
    const lot = (await db.db.query<{ listing_id: string }>("select listing_id from public.auctions where id=$1", [fixture.auctionId])).rows[0].listing_id;
    await expect(rpc(BUYER, "report_listing", [lot, "Private listing report attempt."])).rejects.toThrow(/not found/);
  });

  it("preserves textarea line breaks and tabs in a report reason", async () => {
    const reason = "Condition concern:\nThe lens has marks.\r\n\tPlease review the photos.";
    const report = await rpc<{ reason: string }>(SELLER, "report_listing", [listingId, reason]);
    expect(report.reason).toBe(reason);
  });

  it.each(["PAID", "FULFILLMENT"] as const)("pauses %s atomically and resumes precisely without financial writes", async (status) => {
    const { orderId, auctionId } = await order(status);
    await expect(rpc(RIVAL, "open_dispute", [orderId, "Outsider dispute attempt."])).rejects.toThrow(/participant/);
    await expect(rpc(ADMIN, "open_dispute", [orderId, "Admin is not a participant."])).rejects.toThrow(/participant/);
    expect(await rpc(BUYER, "order_dispute", [orderId])).toBeNull();
    const dispute = await rpc(BUYER, "open_dispute", [orderId, "The delivered condition differs."]);
    expect(dispute.previousStatus).toBe(status);
    expect((await rpc(SELLER, "open_dispute", [orderId, "Seller has another explanation."])).id).toBe(dispute.id);
    expect((await db.db.query<{ status: string; state: string }>("select o.status,a.state from public.orders o join public.auctions a on a.id=o.auction_id where o.id=$1", [orderId])).rows[0]).toEqual({ status: "DISPUTED", state: "DISPUTED" });
    await expect(rpc(RIVAL, "order_dispute", [orderId])).rejects.toThrow(/participant/);
    await expect(rpc(BUYER, "resolve_dispute", [dispute.id, "Buyer cannot resolve this."])).rejects.toThrow(/Administrator/);
    await expect(rpc(SELLER, "ship_order", [orderId, "JNE", "TRACK123456"])).rejects.toThrow(/not ready/);
    await expect(rpc(BUYER, "confirm_received", [orderId])).rejects.toThrow();
    await expect(rpc(BUYER, "review_order", [orderId, 5, "Review during a dispute."])).rejects.toThrow();
    const resolved = await rpc(ADMIN, "resolve_dispute", [dispute.id, "Both participants agreed to resume."]);
    expect(resolved.status).toBe("resolved_resume");
    await rpc(ADMIN, "resolve_dispute", [dispute.id, "Both participants agreed to resume."]);
    expect((await db.db.query<{ status: string; state: string }>("select o.status,a.state from public.orders o join public.auctions a on a.id=o.auction_id where o.id=$1", [orderId])).rows[0]).toEqual({ status, state: status });
    expect((await db.db.query("select id from public.admin_actions where subject_id=$1", [dispute.id])).rows).toHaveLength(1);
    expect((await db.db.query("select id from public.payments where order_id=$1 union all select id from public.payouts where order_id=$1", [orderId])).rows).toHaveLength(0);
    expect((await rpc(BUYER, "open_dispute", [orderId, "Retry after resolution."])).status).toBe("resolved_resume");
    expect((await db.db.query<{ state: string }>("select state from public.auctions where id=$1", [auctionId])).rows[0].state).toBe(status);
  });

  it.each(["AWAITING_PAYMENT", "COMPLETED"] as const)("rejects disputes in %s", async (status) => {
    const { orderId } = await order(status);
    await expect(rpc(BUYER, "open_dispute", [orderId, "An ineligible dispute attempt."])).rejects.toThrow(/paid or shipped/);
  });

  it("restricts dashboard, direct writes and private helper execution", async () => {
    await expect(rpc(BUYER, "trust_safety_dashboard")).rejects.toThrow(/Administrator/);
    await expect(rpc(null, "trust_safety_dashboard")).rejects.toThrow(/permission/);
    const dashboard = await rpc<{ reports: unknown[]; disputes: unknown[]; accounts: unknown[] }>(ADMIN, "trust_safety_dashboard");
    expect(dashboard.reports.length).toBeGreaterThan(0);
    expect(dashboard.disputes.length).toBeGreaterThan(0);
    expect(dashboard.accounts).toHaveLength(4);
    for (const sql of ["update public.reports set status='dismissed'", "update public.disputes set status='resolved_resume'", "update private.account_roles set suspended=false", "select private.trust_reason('private helper attempt')"]) {
      await expect(runAsIdentity(db, BUYER, (tx) => tx.query(sql))).rejects.toThrow(/permission/);
    }
    const hidden = await runAsIdentity(db, RIVAL, (tx) => tx.query("select * from public.disputes"));
    expect(hidden.rows).toHaveLength(0);
  });

  it("audits suspension, protects administrators and blocks suspended mutations", async () => {
    await expect(rpc(BUYER, "set_account_suspension", [RIVAL, true, "A non-admin suspension attempt."])).rejects.toThrow(/Administrator/);
    await expect(rpc(ADMIN, "set_account_suspension", [ADMIN, true, "Attempting to suspend myself."])).rejects.toThrow(/Administrator accounts/);
    await rpc(ADMIN, "set_account_suspension", [RIVAL, true, "Documented repeated policy breaches."]);
    await rpc(ADMIN, "set_account_suspension", [RIVAL, true, "Documented repeated policy breaches."]);
    expect((await db.db.query("select id from public.admin_actions where subject_id=$1 and action='account_suspended'", [RIVAL])).rows).toHaveLength(1);
    await expect(rpc(RIVAL, "report_listing", [listingId, "A suspended report attempt."])).rejects.toThrow(/active sign-in/);
    const suspendedOrder = await order("PAID");
    await db.db.query("update public.orders set buyer_id=$1 where id=$2", [RIVAL, suspendedOrder.orderId]);
    await expect(rpc(RIVAL, "open_dispute", [suspendedOrder.orderId, "A suspended dispute attempt."])).rejects.toThrow(/active sign-in/);
    await expect(rpc(RIVAL, "trust_safety_dashboard")).rejects.toThrow(/active sign-in/);
    const live = (await db.db.query<{ id: string }>("select id from public.auctions where listing_id=$1", [listingId])).rows[0].id;
    await expect(rpc(RIVAL, "place_bid", [live, 3000000, crypto.randomUUID()])).rejects.toThrow(/active sign-in/);
    await rpc(ADMIN, "set_account_suspension", [RIVAL, false, "Review completed and access restored."]);
    expect((await rpc(RIVAL, "report_listing", [listingId, "Access was restored after review."])).status).toBe("open");
  });
});
