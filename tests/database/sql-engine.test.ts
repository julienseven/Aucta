/**
 * Real SQL tests against supabase/migrations + seed via PGlite (not engine.ts).
 *
 * Concurrency: Promise.all around place_bid is queued through runAsIdentity
 * (one identity+query transaction at a time per LocalDatabase). Direct
 * db.transaction Promise.all still serializes on PGlite 0.5.8's process mutex —
 * no true overlapping WAL transactions were observed (10/10 fulfilled, 0 busy
 * errors). Near-close hasselblad requests therefore cannot interleave with
 * settle_due on a single in-memory instance; uniqueness still holds.
 *
 * Observed (in-memory PGlite 0.5.8, queued through runAsIdentity):
 * 10 bids: 44ms, leader extra[9] max 2450000, price 2450000, 10 proxy rows
 * 50 bids: 198ms, leader extra[49] max 4450000, price 4450000, 50 proxy rows
 * 100 hasselblad requests: 391ms, 0 rejections, 41 proxy rows, price 15900000,
 * extension_count 1, then 1 order after expire+settle_due; replay after close ok
 *
 * auction_detail uses table alias `lot` so it does not clash with rowtype `a`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDatabase, runAsIdentity, runAsService } from "../../src/lib/server/database";

type Db = Awaited<ReturnType<typeof createDatabase>>;

const SELLER = "00000000-0000-0000-0000-000000000001";
const BUYER = "00000000-0000-0000-0000-000000000002";
const RIVAL = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const SHOP = "11111111-0000-0000-0000-000000000001";
const CAT_WATCHES = "c0000000-0000-0000-0000-000000000001";
const WATCH = "bbbbbbbb-0000-0000-0000-000000000001";
const CAMERA = "bbbbbbbb-0000-0000-0000-000000000002";
const EAMES = "bbbbbbbb-0000-0000-0000-000000000005";

const WATCH_SLUG = "seiko-6139-pogue-chronograph";
const CAMERA_SLUG = "hasselblad-500cm-planar";

const WATCH_BUYER_MAX = 2_000_000;
const WATCH_RIVAL_MAX = 1_600_000;
const CAMERA_BUYER_MAX = 9_000_000;
const GAME_RIVAL_MAX = 1_800_000;
const GAME_RESERVE = 3_000_000;
const EAMES_RESERVE = 20_000_000;

function num(value: unknown): number {
  return Number(value);
}

function idOf(value: unknown): string {
  return String(value).toLowerCase();
}

function increment(price: number, override: number | null = null): number {
  if (override != null) return override;
  if (price < 1_000_000) return 25_000;
  if (price < 5_000_000) return 50_000;
  if (price < 20_000_000) return 100_000;
  return 250_000;
}

function visiblePrice(starting: number, current: number, topMax: number, secondMax: number | null, reserve: number | null): number {
  let price = Math.max(starting, current);
  if (secondMax != null) price = Math.max(price, Math.min(topMax, secondMax + increment(secondMax)));
  if (reserve != null && topMax >= reserve) price = Math.max(price, reserve);
  return Math.min(topMax, price);
}

function bidderId(n: number, series = 1): string {
  return `00000000-0000-0000-000${series}-${String(n).padStart(12, "0")}`;
}

function asJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function walk(value: unknown, keys: Set<string>, numbers: Set<number>): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, keys, numbers);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      walk(nested, keys, numbers);
    }
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) numbers.add(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) numbers.add(Number(value));
}

function collect(value: unknown): { keys: Set<string>; numbers: Set<number> } {
  const keys = new Set<string>();
  const numbers = new Set<number>();
  walk(value, keys, numbers);
  return { keys, numbers };
}

async function rpc<T>(db: Db, userId: string | null, sql: string, params: unknown[] = []): Promise<T> {
  return runAsIdentity(db, userId, async (tx) => {
    const result = await tx.query<{ result: T }>(sql, params);
    return asJson<T>(result.rows[0].result);
  });
}

async function placeBid(db: Db, userId: string, auctionId: string, maximum: number, key = crypto.randomUUID()) {
  const result = await rpc<PlaceBid>(
    db,
    userId,
    "select public.place_bid(p_auction_id => $1, p_maximum => $2, p_idempotency_key => $3) as result",
    [auctionId, maximum, key],
  );
  return { result, key };
}

async function settleDue(db: Db, limit = 50) {
  return runAsService(db, async (tx) => {
    const result = await tx.query<{ result: { processed: number } }>("select public.settle_due(p_limit => $1) as result", [limit]);
    return result.rows[0].result;
  });
}

async function catalogue(db: Db, userId: string | null) {
  return rpc<{ auctions: Record<string, unknown>[]; server_time: unknown }>(db, userId, "select public.catalogue() as result");
}

async function auctionDetail(db: Db, userId: string | null, slug: string) {
  return rpc<Detail>(db, userId, "select public.auction_detail(p_slug => $1) as result", [slug]);
}

async function insertBidders(db: Db, count: number, series: number): Promise<string[]> {
  await db.db.query(
    `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
     select ('00000000-0000-0000-000' || $2::text || '-' || lpad(g::text, 12, '0'))::uuid,
            'sql-bidder-' || $2::text || '-' || g || '@aucta.local',
            clock_timestamp(),
            jsonb_build_object('display_name', 'SQL Bidder ' || g)
     from generate_series(1, $1::int) g`,
    [count, series],
  );
  return Array.from({ length: count }, (_, i) => bidderId(i + 1, series));
}

async function insertLiveAuction(db: Db, options: { starting?: number; reserve?: number | null; seconds?: number } = {}): Promise<string> {
  const listingId = crypto.randomUUID();
  const auctionId = crypto.randomUUID();
  const starting = options.starting ?? 1_000_000;
  const reserve = options.reserve ?? null;
  const seconds = options.seconds ?? 172_800;
  const slug = `sql-lot-${listingId.slice(0, 8)}`;
  await db.db.query(
    `insert into public.listings(id,seller_id,category_id,brand,slug,title,description,condition,sample)
     values($1,$2,$3,'Test',$4,$5,'PGlite SQL fixture','Good',true)`,
    [listingId, SHOP, CAT_WATCHES, slug, `SQL fixture ${slug}`],
  );
  await db.db.query(
    `insert into public.auctions(id,listing_id,state,starts_at,ends_at,starting_price,current_price,shipping_price,has_reserve,reserve_met,sample)
     values($1,$2,'LIVE',clock_timestamp()-interval '1 hour',clock_timestamp()+make_interval(secs => $3),$4,$4,0,$5,$6,true)`,
    [auctionId, listingId, seconds, starting, reserve != null, reserve == null],
  );
  await db.db.query(`insert into private.auction_rules(auction_id,reserve_price) values($1,$2)`, [auctionId, reserve]);
  return auctionId;
}

async function auctionRow(db: Db, auctionId: string) {
  const result = await db.db.query<{
    current_price: string | number;
    starting_price: string | number;
    bid_count: number;
    bidder_count: number;
    ends_at: string;
    state: string;
    extension_count: number;
    increment_override: string | number | null;
  }>(
    `select current_price, starting_price, bid_count, bidder_count, ends_at, state, extension_count, increment_override
     from public.auctions where id=$1`,
    [auctionId],
  );
  return result.rows[0];
}

async function proxies(db: Db, auctionId: string) {
  const result = await db.db.query<{ bidder_id: string; maximum: string | number; priority: string | number }>(
    `select bidder_id, maximum, priority from private.proxy_bids where auction_id=$1 order by maximum desc, priority asc`,
    [auctionId],
  );
  return result.rows;
}

async function publicAmounts(db: Db, auctionId: string) {
  const result = await db.db.query<{ amount: string | number }>(
    `select amount from public.bids where auction_id=$1 order by created_at asc, id asc`,
    [auctionId],
  );
  return result.rows.map((row) => num(row.amount));
}

async function winnerOf(db: Db, auctionId: string) {
  const result = await db.db.query<{ winning_user_id: string | null }>(
    `select winning_user_id from private.auction_rules where auction_id=$1`,
    [auctionId],
  );
  return result.rows[0]?.winning_user_id ?? null;
}

async function expire(db: Db, auctionId: string) {
  await db.db.query(`update public.auctions set ends_at=clock_timestamp()-interval '1 second' where id=$1`, [auctionId]);
}

async function orderIds(db: Db, auctionId: string) {
  const result = await db.db.query<{ id: string }>(`select id from public.orders where auction_id=$1`, [auctionId]);
  return result.rows.map((row) => idOf(row.id));
}

function expectDenied(promise: Promise<unknown>) {
  return expect(promise).rejects.toThrow(/permission denied|not granted|42501|Verified, active sign-in|Sellers cannot bid/i);
}

type PlaceBid = {
  auction: { id: string; current_price: number | string; bid_count: number; ends_at: string; extension_count?: number };
  own_maximum: number | string;
  is_leading: boolean;
  extended: boolean;
};

type Detail = {
  auction: Record<string, unknown> | null;
  bids: unknown[];
  own_maximum: number | string | null;
  is_leading: boolean;
};

describe("SQL negative permissions and public JSON", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
  }, 60_000);

  afterAll(async () => {
    await db?.db.close();
  });

  it("anon cannot place_bid", async () => {
    await expectDenied(
      runAsIdentity(db, null, (tx) =>
        tx.query("select public.place_bid(p_auction_id => $1, p_maximum => $2, p_idempotency_key => $3) as result", [
          WATCH,
          5_000_000,
          crypto.randomUUID(),
        ]),
      ),
    );
  });

  it("seller cannot bid on own auction", async () => {
    await expect(
      placeBid(db, SELLER, WATCH, 5_000_000),
    ).rejects.toThrow(/Sellers cannot bid on their own auctions/i);
  });

  it("authenticated cannot SELECT from private.proxy_bids", async () => {
    await expectDenied(runAsIdentity(db, BUYER, (tx) => tx.query("select * from private.proxy_bids")));
    await expectDenied(runAsIdentity(db, ADMIN, (tx) => tx.query("select maximum from private.proxy_bids limit 1")));
  });

  it("buyer cannot set private.account_roles.role to admin", async () => {
    await expectDenied(
      runAsIdentity(db, BUYER, (tx) => tx.query("update private.account_roles set role='admin' where user_id=$1", [BUYER])),
    );
    const role = await db.db.query<{ role: string }>("select role from private.account_roles where user_id=$1", [BUYER]);
    expect(role.rows[0].role).toBe("buyer");
  });

  it("catalogue JSON has no reserve_price or maximum ceilings", async () => {
    const body = await catalogue(db, null);
    expect(body.auctions).toHaveLength(6);
    const { keys, numbers } = collect(body);
    expect(keys.has("reserve_price")).toBe(false);
    expect(keys.has("own_maximum")).toBe(false);
    expect(keys.has("maximum")).toBe(false);
    expect(keys.has("winning_user_id")).toBe(false);
    expect(keys.has("proxy_bids")).toBe(false);
    for (const secret of [WATCH_BUYER_MAX, WATCH_RIVAL_MAX, CAMERA_BUYER_MAX, GAME_RIVAL_MAX, GAME_RESERVE, EAMES_RESERVE]) {
      expect(numbers.has(secret)).toBe(false);
    }
  });

  it("auction_detail as buyer includes own_maximum; as anon does not include other maxima", async () => {
    const asBuyer = await auctionDetail(db, BUYER, WATCH_SLUG);
    expect(num(asBuyer.own_maximum)).toBe(WATCH_BUYER_MAX);
    expect(asBuyer.is_leading).toBe(true);
    expect(collect(asBuyer).numbers.has(WATCH_RIVAL_MAX)).toBe(false);

    const asAnon = await auctionDetail(db, null, WATCH_SLUG);
    expect(asAnon.own_maximum).toBeNull();
    expect(asAnon.is_leading).toBe(false);
    const anonNumbers = collect(asAnon).numbers;
    expect(anonNumbers.has(WATCH_BUYER_MAX)).toBe(false);
    expect(anonNumbers.has(WATCH_RIVAL_MAX)).toBe(false);

    const cameraAnon = await auctionDetail(db, null, CAMERA_SLUG);
    expect(cameraAnon.own_maximum).toBeNull();
    expect(collect(cameraAnon).numbers.has(CAMERA_BUYER_MAX)).toBe(false);
  });
});

describe("SQL bidding, concurrency and settlement", () => {
  let db: Db;
  let extra: string[];

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
    extra = await insertBidders(db, 50, 1);
  }, 60_000);

  afterAll(async () => {
    await db?.db.close();
  });

  it("two users compete on a LIVE lot and visible price follows increment rules", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000 });
    const first = await placeBid(db, BUYER, auctionId, 2_000_000);
    expect(first.result.is_leading).toBe(true);
    expect(num(first.result.auction.current_price)).toBe(1_000_000);
    expect(first.result.auction.bid_count).toBe(1);

    const second = await placeBid(db, RIVAL, auctionId, 1_300_000);
    expect(second.result.is_leading).toBe(false);
    expect(num(second.result.auction.current_price)).toBe(1_350_000);
    expect(second.result.auction.bid_count).toBe(2);
    expect(idOf(await winnerOf(db, auctionId))).toBe(BUYER);
    expect(visiblePrice(1_000_000, 1_000_000, 2_000_000, 1_300_000, null)).toBe(1_350_000);
  });

  it("equal maxima: earlier priority wins, including raise-to-equal", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000 });
    await placeBid(db, BUYER, auctionId, 2_000_000);
    const tied = await placeBid(db, RIVAL, auctionId, 2_000_000);
    expect(tied.result.is_leading).toBe(false);
    expect(num(tied.result.auction.current_price)).toBe(2_000_000);
    expect(idOf(await winnerOf(db, auctionId))).toBe(BUYER);
    const ranked = await proxies(db, auctionId);
    expect(idOf(ranked[0].bidder_id)).toBe(BUYER);
    expect(num(ranked[0].priority)).toBeLessThan(num(ranked[1].priority));

    const steal = await insertLiveAuction(db, { starting: 1_000_000 });
    await placeBid(db, BUYER, steal, 2_000_000);
    await placeBid(db, RIVAL, steal, 3_000_000);
    await placeBid(db, BUYER, steal, 3_000_000);
    expect(idOf(await winnerOf(db, steal))).toBe(RIVAL);
    expect(num((await auctionRow(db, steal)).current_price)).toBe(3_000_000);
  });

  it("leader raising ceiling does not increment bid_count or extend", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000, seconds: 90 });
    await placeBid(db, BUYER, auctionId, 2_000_000);
    const competed = await placeBid(db, RIVAL, auctionId, 1_300_000);
    const before = await auctionRow(db, auctionId);
    expect(before.bid_count).toBe(2);
    const raised = await placeBid(db, BUYER, auctionId, 3_000_000);
    const after = await auctionRow(db, auctionId);
    expect(raised.result.extended).toBe(false);
    expect(after.bid_count).toBe(before.bid_count);
    expect(after.extension_count).toBe(before.extension_count);
    expect(new Date(after.ends_at).getTime()).toBe(new Date(before.ends_at).getTime());
    expect(num(after.current_price)).toBe(num(competed.result.auction.current_price));
    expect(idOf(await winnerOf(db, auctionId))).toBe(BUYER);
  });

  it("10 simultaneous-ish bids: one leader, monotonic price, one proxy per bidder", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000 });
    const users = extra.slice(0, 10);
    const results = await Promise.all(
      users.map((userId, index) => placeBid(db, userId, auctionId, 2_000_000 + index * 50_000)),
    );
    expect(results).toHaveLength(10);
    const row = await auctionRow(db, auctionId);
    const ranked = await proxies(db, auctionId);
    const amounts = await publicAmounts(db, auctionId);
    expect(ranked).toHaveLength(10);
    expect(new Set(ranked.map((proxy) => idOf(proxy.bidder_id))).size).toBe(10);
    expect(row.bid_count).toBe(10);
    expect(row.bidder_count).toBe(10);
    expect(idOf(await winnerOf(db, auctionId))).toBe(idOf(ranked[0].bidder_id));
    expect(idOf(ranked[0].bidder_id)).toBe(idOf(users[9]));
    expect(num(row.current_price)).toBe(
      visiblePrice(1_000_000, 1_000_000, num(ranked[0].maximum), num(ranked[1].maximum), null),
    );
    // Observed queued-10: leader extra[9] max 2_450_000, price 2_450_000, 10 public bids.
    expect(amounts).toHaveLength(10);
    for (let i = 1; i < amounts.length; i++) expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
    expect(amounts[amounts.length - 1]).toBe(num(row.current_price));
  }, 60_000);

  it("direct db.transaction Promise.all still serializes (PGlite mutex)", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000 });
    const users = extra.slice(10, 20);
    const outcomes = await Promise.allSettled(
      users.map((userId, index) =>
        db.db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
          await tx.exec("set local role authenticated");
          return tx.query("select public.place_bid(p_auction_id => $1, p_maximum => $2, p_idempotency_key => $3) as result", [
            auctionId,
            2_000_000 + index * 50_000,
            crypto.randomUUID(),
          ]);
        }),
      ),
    );
    const fulfilled = outcomes.filter((row) => row.status === "fulfilled").length;
    const rejected = outcomes.filter((row) => row.status === "rejected");
    // Observed: 10 fulfilled, 0 rejected — mutex queue, not true overlap.
    expect(fulfilled).toBe(10);
    expect(rejected).toHaveLength(0);
    expect(await proxies(db, auctionId)).toHaveLength(10);
  }, 60_000);

  it("50 competing bids: one leader, monotonic price, one proxy per bidder", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000 });
    const results = await Promise.all(
      extra.map((userId, index) => placeBid(db, userId, auctionId, 2_000_000 + index * 50_000)),
    );
    expect(results).toHaveLength(50);
    const row = await auctionRow(db, auctionId);
    const ranked = await proxies(db, auctionId);
    const amounts = await publicAmounts(db, auctionId);
    expect(ranked).toHaveLength(50);
    expect(new Set(ranked.map((proxy) => idOf(proxy.bidder_id))).size).toBe(50);
    expect(row.bid_count).toBe(50);
    expect(idOf(await winnerOf(db, auctionId))).toBe(idOf(extra[49]));
    expect(num(row.current_price)).toBe(
      visiblePrice(1_000_000, 1_000_000, num(ranked[0].maximum), num(ranked[1].maximum), null),
    );
    // Observed queued-50: leader extra[49] max 4_450_000, price 4_450_000, 50 public bids.
    expect(amounts).toHaveLength(50);
    for (let i = 1; i < amounts.length; i++) expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
    expect(amounts[amounts.length - 1]).toBe(num(row.current_price));
  }, 120_000);

  it("settle_due twice is idempotent (same order id)", async () => {
    const auctionId = await insertLiveAuction(db, { starting: 1_000_000 });
    await placeBid(db, BUYER, auctionId, 2_000_000);
    await placeBid(db, RIVAL, auctionId, 1_500_000);
    await expire(db, auctionId);
    await settleDue(db);
    const first = await orderIds(db, auctionId);
    expect(first).toHaveLength(1);
    await settleDue(db);
    const second = await orderIds(db, auctionId);
    expect(second).toEqual(first);
    const row = await auctionRow(db, auctionId);
    expect(row.state).toBe("AWAITING_PAYMENT");
    expect(idOf(await winnerOf(db, auctionId))).toBe(BUYER);
  });

  it("NO_SALE lot (eames) produces no order", async () => {
    expect(await orderIds(db, EAMES)).toHaveLength(0);
    expect((await auctionRow(db, EAMES)).state).toBe("NO_SALE");
    const listed = (await catalogue(db, null)).auctions.find((row) => row.id === EAMES || idOf(row.id) === EAMES);
    expect(listed?.state).toBe("NO_SALE");
    expect(collect(listed).numbers.has(EAMES_RESERVE)).toBe(false);
    await settleDue(db);
    expect(await orderIds(db, EAMES)).toHaveLength(0);

    const unmet = await insertLiveAuction(db, { starting: 1_000_000, reserve: 5_000_000 });
    await placeBid(db, BUYER, unmet, 2_000_000);
    await expire(db, unmet);
    await settleDue(db);
    expect(await orderIds(db, unmet)).toHaveLength(0);
    expect((await auctionRow(db, unmet)).state).toBe("NO_SALE");
  });
});

describe("SQL near-close hasselblad storm", () => {
  let db: Db;
  let extras: string[];

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
    extras = await insertBidders(db, 40, 2);
  }, 60_000);

  afterAll(async () => {
    await db?.db.close();
  });

  it("100 requests near closing: at most one order, no late bid except idempotent replay, competitive bids may extend", async () => {
    const opening = await auctionRow(db, CAMERA);
    const remainingMs =
      Date.parse(opening.ends_at) - Date.parse((await db.db.query<{ now: string }>("select clock_timestamp() as now")).rows[0].now);
    expect(remainingMs).toBeGreaterThan(0);
    expect(remainingMs).toBeLessThanOrEqual(120_000);

    const jobs: Array<Promise<unknown>> = [];
    const originals: Array<{ userId: string; maximum: number; key: string }> = [];
    for (let index = 0; index < 40; index++) {
      const userId = extras[index];
      const maximum = 12_000_000 + index * 100_000;
      const key = crypto.randomUUID();
      originals.push({ userId, maximum, key });
      jobs.push(placeBid(db, userId, CAMERA, maximum, key));
    }
    for (const original of originals) {
      jobs.push(placeBid(db, original.userId, CAMERA, original.maximum, original.key));
    }
    for (let index = 0; index < 20; index++) jobs.push(settleDue(db));
    expect(jobs).toHaveLength(100);

    const outcomes = await Promise.allSettled(jobs);
    const failed = outcomes.filter((row) => row.status === "rejected");
    expect(failed).toHaveLength(0);
    expect(await orderIds(db, CAMERA)).toHaveLength(0);

    const afterStorm = await auctionRow(db, CAMERA);
    const ranked = await proxies(db, CAMERA);
    const amounts = await publicAmounts(db, CAMERA);
    expect(afterStorm.state).toBe("LIVE");
    expect(afterStorm.extension_count).toBe(1);
    expect(new Date(afterStorm.ends_at).getTime()).toBeGreaterThan(new Date(opening.ends_at).getTime());
    expect(ranked).toHaveLength(41);
    expect(afterStorm.bid_count).toBe(41);
    expect(num(afterStorm.current_price)).toBe(15_900_000);
    expect(new Set(ranked.map((proxy) => idOf(proxy.bidder_id))).size).toBe(41);
    expect(idOf(await winnerOf(db, CAMERA))).toBe(idOf(ranked[0].bidder_id));
    expect(idOf(ranked[0].bidder_id)).toBe(idOf(extras[39]));
    for (let i = 1; i < amounts.length; i++) expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
    expect(amounts[amounts.length - 1]).toBe(num(afterStorm.current_price));
    // 40 competitive + 40 idempotent replays + 20 settle_due; seed buyer proxy remains; 0 orders while LIVE.

    const replay = originals[0];
    await expire(db, CAMERA);
    await expect(placeBid(db, extras[0], CAMERA, 20_000_000, crypto.randomUUID())).rejects.toThrow(/not open for bidding/i);
    const replayed = await placeBid(db, replay.userId, CAMERA, replay.maximum, replay.key);
    expect(num(replayed.result.own_maximum)).toBe(replay.maximum);

    await settleDue(db);
    const first = await orderIds(db, CAMERA);
    expect(first).toHaveLength(1);
    await settleDue(db);
    expect(await orderIds(db, CAMERA)).toEqual(first);
    expect((await auctionRow(db, CAMERA)).state).toBe("AWAITING_PAYMENT");
    expect((await db.db.query<{ n: number }>("select count(*)::int as n from public.orders where auction_id=$1", [CAMERA])).rows[0].n).toBe(1);
  }, 180_000);
});
