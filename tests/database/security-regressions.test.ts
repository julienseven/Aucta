import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, runAsIdentity, runAsService } from "../../src/lib/server/database";

type Database = Awaited<ReturnType<typeof createDatabase>>;
const BUYER = "00000000-0000-0000-0000-000000000002";
const RIVAL = "00000000-0000-0000-0000-000000000003";
const SELLER = "00000000-0000-0000-0000-000000000001";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const WATCH = "bbbbbbbb-0000-0000-0000-000000000001";

async function asUser<Row = Record<string, unknown>>(db: Database, user: string | null, sql: string, args: unknown[] = []) {
  return runAsIdentity(db, user, (tx) => tx.query<Row>(sql, args));
}

async function fixture(db: Database, state = "LIVE") {
  const listing = crypto.randomUUID();
  const auction = crypto.randomUUID();
  await db.db.query(`insert into public.listings(id,seller_id,category_id,slug,title,sample)
    values($1,'11111111-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',$2,'Security test fixture',true)`, [listing, `security-${listing}`]);
  await db.db.query(`insert into public.auctions(id,listing_id,state,starts_at,ends_at,starting_price,current_price,sample)
    values($1,$2,$3,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',1000000,1000000,true)`, [auction, listing, state]);
  await db.db.query("insert into private.auction_rules(auction_id) values($1)", [auction]);
  return { listing, auction };
}

describe("SQL permission regressions", () => {
  let db: Database;
  beforeAll(async () => { db = await createDatabase({ seed: true }); }, 60_000);
  afterAll(async () => { await db?.db.close(); });

  it("untrusted roles cannot forge notification or audit records through private helpers", async () => {
    for (const user of [null, BUYER]) {
      await expect(asUser(db, user, "select private.notify($1,'forged',$2,'Forged','Forged',null)", [RIVAL, crypto.randomUUID()])).rejects.toThrow(/permission denied/i);
      await expect(asUser(db, user, "select private.audit($1,'forged',$2,'Forged action')", [ADMIN, WATCH])).rejects.toThrow(/permission denied/i);
    }
    const audit = await db.db.query("select id from private.audit_logs where action='forged'");
    expect(audit.rows).toHaveLength(0);
  });

  it("only the three RLS predicate helpers are executable in private by untrusted roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      const result = await db.db.query<{ name: string }>(`select p.proname as name from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
        and has_function_privilege($1,p.oid,'EXECUTE') order by p.proname`, [role]);
      expect(result.rows.map((row) => row.name)).toEqual(["is_admin", "listing_visible", "owns_seller"]);
    }
  });

  it("unpublished lots cannot be watched by other users", async () => {
    const { auction } = await fixture(db, "DRAFT");
    await expect(asUser(db, BUYER, "select public.toggle_watch($1)", [auction])).rejects.toThrow(/not available|not found|not published/i);
  });

  it("soft-deleted listings hide their auction and bid rows and reject watching", async () => {
    const { listing, auction } = await fixture(db);
    await db.db.query("insert into public.bids(auction_id,bidder_alias,amount) values($1,'Bidder ABCDEF',1000000)", [auction]);
    await db.db.query("update public.listings set deleted_at=clock_timestamp() where id=$1", [listing]);
    expect((await asUser(db, null, "select id from public.auctions where id=$1", [auction])).rows).toHaveLength(0);
    expect((await asUser(db, BUYER, "select id from public.bids where auction_id=$1", [auction])).rows).toHaveLength(0);
    await expect(asUser(db, BUYER, "select public.toggle_watch($1)", [auction])).rejects.toThrow(/not available|not found|not published/i);
  });

  it("set_watch retries preserve desired state and do not inflate counts or versions", async () => {
    const { auction } = await fixture(db);
    const first = await asUser(db, BUYER, "select public.set_watch($1,true) as result", [auction]);
    expect(first.rows[0].result).toEqual({ watching: true, watch_count: 1 });
    const before = await db.db.query<{ version: number }>("select version from public.auctions where id=$1", [auction]);
    await Promise.all(Array.from({ length: 5 }, () => asUser(db, BUYER, "select public.set_watch($1,true)", [auction])));
    const after = await db.db.query<{ version: number; watch_count: number }>("select version,watch_count from public.auctions where id=$1", [auction]);
    expect(after.rows[0].watch_count).toBe(1);
    expect(after.rows[0].version).toBe(before.rows[0].version);
    await asUser(db, RIVAL, "select public.set_watch($1,true)", [auction]);
    await asUser(db, BUYER, "select public.set_watch($1,false)", [auction]);
    const removed = await asUser(db, BUYER, "select public.set_watch($1,false) as result", [auction]);
    expect(removed.rows[0].result).toEqual({ watching: false, watch_count: 1 });
    await expect(asUser(db, null, "select public.set_watch($1,true)", [auction])).rejects.toThrow(/permission denied/i);
    await expect(asUser(db, BUYER, "select public.set_watch($1,null)", [auction])).rejects.toThrow(/Watching state/i);
  });

  it("soft-deleted lots cannot accept fresh bids", async () => {
    const { listing, auction } = await fixture(db);
    await db.db.query("update public.listings set deleted_at=clock_timestamp() where id=$1", [listing]);
    await expect(asUser(db, BUYER, "select public.place_bid($1,2000000,$2)", [auction, crypto.randomUUID()])).rejects.toThrow(/not available/i);
    expect((await db.db.query("select * from private.proxy_bids where auction_id=$1", [auction])).rows).toHaveLength(0);
  });

  it("closing is service-role only and rejects an unbounded NULL batch", async () => {
    for (const user of [null, BUYER, ADMIN]) {
      await expect(asUser(db, user, "select public.settle_due(50)")).rejects.toThrow(/permission denied/i);
    }
    for (const limit of [null, 0, 101]) {
      await expect(runAsService(db, (tx) => tx.query("select public.settle_due($1)", [limit]))).rejects.toThrow(/Batch limit/i);
    }
  });

  it("bounded settlement starts scheduled auctions despite earlier live lots", async () => {
    const { auction } = await fixture(db, "SCHEDULED");
    await db.db.query("update public.auctions set ends_at=clock_timestamp()+interval '7 days' where id=$1", [auction]);
    const result = await runAsService(db, (tx) => tx.query<{ result: { processed: number } }>("select public.settle_due(1) as result"));
    expect(result.rows[0].result).toMatchObject({ processed: 1 });
    expect((await db.db.query<{ state: string }>("select state from public.auctions where id=$1", [auction])).rows[0].state).toBe("LIVE");
  });

  it("a service transaction does not leak its role or identity into the next request", async () => {
    await runAsService(db, (tx) => tx.query("select public.settle_due(1)"));
    const anon = await asUser(db, null, "select current_user as role,auth.uid() as actor");
    expect(anon.rows[0]).toEqual({ role: "anon", actor: null });
    await expect(asUser(db, null, "select public.settle_due(1)")).rejects.toThrow(/permission denied/i);
  });

  it("suspended and unverified bidders cannot mutate auctions", async () => {
    await db.db.query("update private.account_roles set suspended=true where user_id=$1", [RIVAL]);
    try {
      await expect(asUser(db, RIVAL, "select public.place_bid($1,5000000,$2)", [WATCH, crypto.randomUUID()])).rejects.toThrow(/Verified, active sign-in/i);
    } finally { await db.db.query("update private.account_roles set suspended=false where user_id=$1", [RIVAL]); }
    await db.db.query("update auth.users set email_confirmed_at=null where id=$1", [RIVAL]);
    try {
      await expect(asUser(db, RIVAL, "select public.place_bid($1,5000000,$2)", [WATCH, crypto.randomUUID()])).rejects.toThrow(/Verified, active sign-in/i);
    } finally { await db.db.query("update auth.users set email_confirmed_at=clock_timestamp() where id=$1", [RIVAL]); }
  });

  it("buyer and admin sessions cannot directly modify money or privileged roles", async () => {
    for (const user of [BUYER, ADMIN]) {
      for (const sql of ["update public.auctions set current_price=1", "update public.orders set status='PAID'", "update public.seller_profiles set verification_status='verified'", "update private.account_roles set role='admin'"]) {
        await expect(asUser(db, user, sql)).rejects.toThrow(/permission denied/i);
      }
    }
  });

  it("orders and addresses are invisible to unrelated buyers", async () => {
    await db.db.query("insert into public.addresses(user_id,recipient_name,phone,line1,city,province,postal_code) values($1,'Private','123','Private lane','City','Province','12345')", [BUYER]);
    expect((await asUser(db, RIVAL, "select id from public.orders")).rows).toHaveLength(0);
    expect((await asUser(db, RIVAL, "select id from public.addresses")).rows).toHaveLength(0);
    expect((await asUser(db, SELLER, "select id from public.orders")).rows.length).toBeGreaterThan(0);
  });

  it("user metadata cannot create an administrator", async () => {
    const user = crypto.randomUUID();
    await db.db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,clock_timestamp(),'{\"role\":\"admin\",\"suspended\":false}')", [user, `${user}@aucta.local`]);
    const role = await db.db.query<{ role: string }>("select role from private.account_roles where user_id=$1", [user]);
    expect(role.rows[0].role).toBe("buyer");
    expect((await asUser(db, user, "select private.is_admin() as admin")).rows[0].admin).toBe(false);
  });
});
