import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, runAsIdentity } from "../../src/lib/server/database";

type Db = Awaited<ReturnType<typeof createDatabase>>;

const SELLER = "00000000-0000-0000-0000-000000000001";
const BUYER = "00000000-0000-0000-0000-000000000002";
const RIVAL = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const SHOP = "11111111-0000-0000-0000-000000000001";

type ListingEditor = {
  listing_id: string;
  auction_id: string;
  slug: string;
  state: string;
  title: string;
  reserve_price: number | string | null;
};

type SellerModeration = {
  id: string;
  shop_name: string;
  city: string;
  province: string;
  verification_status: string;
  verified: boolean;
};

function asJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function jsonKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) jsonKeys(item, keys);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      jsonKeys(nested, keys);
    }
  }
  return keys;
}

async function rpc<T>(db: Db, userId: string | null, sql: string, params: unknown[] = []): Promise<T> {
  return runAsIdentity(db, userId, async (tx) => {
    const result = await tx.query<{ result: T }>(sql, params);
    return asJson<T>(result.rows[0].result);
  });
}

function completePayload(title: string) {
  return {
    title,
    category_slug: "watches",
    description: "A fictional development lot used to test seller listing submission.",
    condition: "Excellent",
    images: ["/images/watch.png"],
    starting_price: 2_000_000,
    reserve_price: 5_000_000,
  };
}

function save(db: Db, userId: string, listingId: string | null, payload: Record<string, unknown> = {}) {
  return rpc<ListingEditor>(
    db,
    userId,
    "select public.save_listing_draft(p_listing_id => $1, p_payload => $2::jsonb) as result",
    [listingId, JSON.stringify(payload)],
  );
}

function submit(db: Db, userId: string, listingId: string) {
  return rpc<ListingEditor>(db, userId, "select public.submit_listing(p_listing_id => $1) as result", [listingId]);
}

function moderateListing(db: Db, userId: string | null, listingId: string | null, decision: string, reason: string) {
  return rpc<ListingEditor>(
    db,
    userId,
    "select public.moderate_listing(p_listing_id => $1, p_decision => $2, p_reason => $3) as result",
    [listingId, decision, reason],
  );
}

function moderateSeller(db: Db, userId: string | null, sellerId: string | null, decision: string, reason: string) {
  return rpc<SellerModeration>(
    db,
    userId,
    "select public.moderate_seller(p_seller_id => $1, p_decision => $2, p_reason => $3) as result",
    [sellerId, decision, reason],
  );
}

function applySeller(db: Db, userId: string, shop: string, city: string, province: string) {
  return rpc<SellerModeration>(
    db,
    userId,
    "select public.apply_seller(p_shop_name => $1, p_city => $2, p_province => $3) as result",
    [shop, city, province],
  );
}

describe("SQL moderation mutations", () => {
  let db: Db;
  let approved: ListingEditor;

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
  }, 60_000);

  afterAll(async () => {
    await db?.db.close();
  });

  it("anon cannot execute moderate_listing or moderate_seller", async () => {
    await expect(
      runAsIdentity(db, null, (tx) =>
        tx.query("select public.moderate_listing(p_listing_id => $1, p_decision => $2, p_reason => $3)", [
          crypto.randomUUID(),
          "approve",
          "Looks ready for catalogue",
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      runAsIdentity(db, null, (tx) =>
        tx.query("select public.moderate_seller(p_seller_id => $1, p_decision => $2, p_reason => $3)", [
          SHOP,
          "approve",
          "Looks ready for catalogue",
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("Raka and Nadia receive Administrator required", async () => {
    for (const user of [SELLER, BUYER]) {
      await expect(moderateListing(db, user, crypto.randomUUID(), "approve", "Looks ready for catalogue")).rejects.toThrow(
        /Administrator required/i,
      );
      await expect(moderateSeller(db, user, SHOP, "approve", "Looks ready for catalogue")).rejects.toThrow(
        /Administrator required/i,
      );
    }
  });

  it("authenticated direct auction and seller_profile updates still fail", async () => {
    for (const user of [SELLER, ADMIN]) {
      await expect(runAsIdentity(db, user, (tx) => tx.query("update public.auctions set state='LIVE'"))).rejects.toThrow(
        /permission denied/i,
      );
      await expect(
        runAsIdentity(db, user, (tx) => tx.query("update public.seller_profiles set verification_status='verified'")),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("admin approve publishes a complete lot; second approve is idempotent", async () => {
    const draft = await save(db, SELLER, null, completePayload("Moderation approve mutation lot"));
    const pending = await submit(db, SELLER, draft.listing_id);
    expect(pending.state).toBe("PENDING_REVIEW");

    approved = await moderateListing(db, ADMIN, pending.listing_id, "approve", "Looks ready for catalogue");
    expect(["LIVE", "SCHEDULED"]).toContain(approved.state);
    expect(approved.state).toBe("LIVE");
    expect(approved.slug).toBe(draft.slug);

    const catalogue = await rpc<{ auctions: Array<{ listing?: { slug?: string } }> }>(db, null, "select public.catalogue() as result");
    expect(catalogue.auctions.some((row) => row.listing?.slug === approved.slug)).toBe(true);
    expect(jsonKeys(catalogue).has("reserve_price")).toBe(false);

    const actions = await db.db.query<{ id: string }>(
      "select id from public.admin_actions where subject_id=$1 and action='listing_approved'",
      [approved.listing_id],
    );
    expect(actions.rows).toHaveLength(1);

    const notes = await db.db.query<{ type: string; title: string; message: string; href: string }>(
      "select type,title,message,href from public.notifications where user_id=$1 and dedupe_key=$2",
      [SELLER, `listing_approved:${approved.listing_id}`],
    );
    expect(notes.rows).toHaveLength(1);
    expect(notes.rows[0]).toMatchObject({
      type: "listing_approved",
      title: "Listing approved",
      message: "Your listing is scheduled or live.",
      href: `/selling/${approved.listing_id}`,
    });

    const again = await moderateListing(db, ADMIN, approved.listing_id, "approve", "Looks ready for catalogue");
    expect(again.state).toBe(approved.state);
    const actionsAfter = await db.db.query<{ id: string }>(
      "select id from public.admin_actions where subject_id=$1 and action='listing_approved'",
      [approved.listing_id],
    );
    expect(actionsAfter.rows).toHaveLength(1);
  });

  it("admin reject hides the lot; seller can save and resubmit", async () => {
    const draft = await save(db, SELLER, null, completePayload("Moderation reject mutation lot"));
    const pending = await submit(db, SELLER, draft.listing_id);
    const rejected = await moderateListing(db, ADMIN, pending.listing_id, "reject", "Photos need a clearer reverse");
    expect(rejected.state).toBe("REJECTED");

    const catalogue = await rpc<{ auctions: Array<{ listing?: { slug?: string } }> }>(db, null, "select public.catalogue() as result");
    expect(catalogue.auctions.some((row) => row.listing?.slug === rejected.slug)).toBe(false);
    expect(jsonKeys(catalogue).has("reserve_price")).toBe(false);

    const notes = await db.db.query<{ type: string; title: string; href: string }>(
      "select type,title,href from public.notifications where user_id=$1 and dedupe_key=$2",
      [SELLER, `listing_rejected:${rejected.listing_id}`],
    );
    expect(notes.rows).toHaveLength(1);
    expect(notes.rows[0]).toMatchObject({
      type: "listing_rejected",
      title: "Listing not approved",
      href: `/selling/${rejected.listing_id}`,
    });

    const saved = await save(db, SELLER, rejected.listing_id, completePayload("Moderation reject mutation lot"));
    expect(saved.state).toBe("REJECTED");
    const resubmitted = await submit(db, SELLER, saved.listing_id);
    expect(resubmitted.state).toBe("PENDING_REVIEW");
  });

  it("approve of an expired pending lot is rejected and stays PENDING_REVIEW", async () => {
    const draft = await save(db, SELLER, null, completePayload("Moderation expired mutation lot"));
    const pending = await submit(db, SELLER, draft.listing_id);
    await db.db.query(
      "update public.auctions set starts_at=clock_timestamp()-interval '3 days', ends_at=clock_timestamp()-interval '1 day' where listing_id=$1",
      [pending.listing_id],
    );
    await expect(moderateListing(db, ADMIN, pending.listing_id, "approve", "Looks ready for catalogue")).rejects.toThrow(
      /This listing expired while awaiting review/i,
    );
    const state = await db.db.query<{ state: string }>("select state from public.auctions where listing_id=$1", [pending.listing_id]);
    expect(state.rows[0].state).toBe("PENDING_REVIEW");
    const actions = await db.db.query(
      "select id from public.admin_actions where subject_id=$1 and action='listing_approved'",
      [pending.listing_id],
    );
    expect(actions.rows).toHaveLength(0);
  });

  it("short moderation reason is rejected", async () => {
    const draft = await save(db, SELLER, null, completePayload("Moderation short reason lot"));
    const pending = await submit(db, SELLER, draft.listing_id);
    await expect(moderateListing(db, ADMIN, pending.listing_id, "approve", "ab")).rejects.toThrow(
      /meaningful moderation reason/i,
    );
    await expect(moderateListing(db, ADMIN, pending.listing_id, "reject", "ab")).rejects.toThrow(
      /meaningful moderation reason/i,
    );
  });

  it("admin reject of Aditya's seller application leaves him rejected", async () => {
    const profile = await applySeller(db, RIVAL, "Aditya Rival Shop", "Surabaya", "East Java");
    expect(profile).toMatchObject({ verification_status: "pending", verified: false });
    const rejected = await moderateSeller(db, ADMIN, profile.id, "reject", "Shop details are incomplete");
    expect(rejected).toMatchObject({
      id: profile.id,
      shop_name: "Aditya Rival Shop",
      verification_status: "rejected",
      verified: false,
    });
    const actions = await db.db.query(
      "select id from public.admin_actions where subject_id=$1 and action='seller_rejected'",
      [profile.id],
    );
    expect(actions.rows).toHaveLength(1);
    const notes = await db.db.query<{ type: string; href: string }>(
      "select type,href from public.notifications where user_id=$1 and dedupe_key=$2",
      [RIVAL, `seller_rejected:${profile.id}`],
    );
    expect(notes.rows).toEqual([{ type: "seller_rejected", href: "/selling" }]);
    const again = await moderateSeller(db, ADMIN, profile.id, "reject", "Shop details are incomplete");
    expect(again.verification_status).toBe("rejected");
    const actionsAfter = await db.db.query(
      "select id from public.admin_actions where subject_id=$1 and action='seller_rejected'",
      [profile.id],
    );
    expect(actionsAfter.rows).toHaveLength(1);
  });

  it("admin approve of Nadia's seller application verifies her; Raka stays verified", async () => {
    const profile = await applySeller(db, BUYER, "Nadia Atelier", "Jakarta", "DKI Jakarta");
    expect(profile).toMatchObject({ verification_status: "pending", verified: false });
    const verified = await moderateSeller(db, ADMIN, profile.id, "approve", "Shop records check out");
    expect(verified).toMatchObject({
      id: profile.id,
      shop_name: "Nadia Atelier",
      city: "Jakarta",
      province: "DKI Jakarta",
      verification_status: "verified",
      verified: true,
    });
    const raka = await db.db.query<{ verification_status: string }>(
      "select verification_status from public.seller_profiles where id=$1",
      [SHOP],
    );
    expect(raka.rows[0].verification_status).toBe("verified");
    const role = await db.db.query<{ role: string }>("select role from private.account_roles where user_id=$1", [BUYER]);
    expect(role.rows[0].role).toBe("seller");
    const notes = await db.db.query<{ type: string; href: string }>(
      "select type,href from public.notifications where user_id=$1 and dedupe_key=$2",
      [BUYER, `seller_approved:${profile.id}`],
    );
    expect(notes.rows).toEqual([{ type: "seller_approved", href: "/selling" }]);
    await expect(moderateSeller(db, RIVAL, profile.id, "approve", "Please verify me now")).rejects.toThrow(
      /Administrator required/i,
    );
    await expect(
      runAsIdentity(db, RIVAL, (tx) =>
        tx.query("update public.seller_profiles set verification_status='verified' where id=$1", [profile.id]),
      ),
    ).rejects.toThrow(/permission denied/i);
    const still = await db.db.query<{ verification_status: string }>(
      "select verification_status from public.seller_profiles where id=$1",
      [profile.id],
    );
    expect(still.rows[0].verification_status).toBe("verified");
  });
});
