import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, runAsIdentity } from "../../src/lib/server/database";

type Db = Awaited<ReturnType<typeof createDatabase>>;

const SELLER = "00000000-0000-0000-0000-000000000001";
const BUYER = "00000000-0000-0000-0000-000000000002";
const RIVAL = "00000000-0000-0000-0000-000000000003";
const ADMIN = "00000000-0000-0000-0000-000000000004";
const LIVE_LISTING = "aaaaaaaa-0000-0000-0000-000000000001";

type ListingEditor = {
  listing_id: string;
  auction_id: string;
  slug: string;
  state: string;
  title: string;
  category_slug: string;
  brand: string;
  description: string;
  condition: string;
  images: string[];
  starting_price: number | string;
  reserve_price: number | string | null;
  shipping_price: number | string;
  sample: boolean;
};

type Dashboard = { pending_listings: Array<{ listing?: { id?: string; slug?: string } }> };

function asJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function num(value: unknown): number {
  return Number(value);
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

function editor(db: Db, userId: string, listingId: string) {
  return rpc<ListingEditor>(db, userId, "select public.listing_editor(p_listing_id => $1) as result", [listingId]);
}

describe("SQL seller listing mutations", () => {
  let db: Db;
  let submitted: ListingEditor;

  beforeAll(async () => {
    db = await createDatabase({ seed: true });
  }, 60_000);

  afterAll(async () => {
    await db?.db.close();
  });

  it("taxonomy is public and ordered by name", async () => {
    const body = await rpc<{ categories: Array<{ slug: string; name: string }> }>(db, null, "select public.taxonomy() as result");
    expect(body.categories.map((row) => row.name)).toEqual([...body.categories.map((row) => row.name)].sort((a, b) => a.localeCompare(b)));
    expect(body.categories[0]?.slug).toBe("cameras");
  });

  it("buyer cannot save_listing_draft or submit_listing", async () => {
    await expect(save(db, RIVAL, null, { title: "Buyer lot" })).rejects.toThrow(/A seller profile is required/i);
    await expect(submit(db, RIVAL, LIVE_LISTING)).rejects.toThrow(/A seller profile is required/i);
    await expect(
      runAsIdentity(db, null, (tx) => tx.query("select public.save_listing_draft(p_listing_id => $1, p_payload => $2::jsonb)", [null, "{}"])),
    ).rejects.toThrow(/permission denied/i);
  });

  it("Nadia apply_seller succeeds; second apply conflicts", async () => {
    const profile = await rpc<{
      id: string;
      shop_name: string;
      city: string;
      province: string;
      verification_status: string;
      verified: boolean;
    }>(db, BUYER, "select public.apply_seller(p_shop_name => $1, p_city => $2, p_province => $3) as result", [
      "Nadia Atelier",
      "Jakarta",
      "DKI Jakarta",
    ]);
    expect(profile).toMatchObject({
      shop_name: "Nadia Atelier",
      city: "Jakarta",
      province: "DKI Jakarta",
      verification_status: "pending",
      verified: false,
    });
    const role = await db.db.query<{ role: string }>("select role from private.account_roles where user_id=$1", [BUYER]);
    expect(role.rows[0].role).toBe("seller");
    await expect(
      rpc(db, BUYER, "select public.apply_seller(p_shop_name => $1, p_city => $2, p_province => $3) as result", [
        "Nadia Atelier",
        "Jakarta",
        "DKI Jakarta",
      ]),
    ).rejects.toThrow(/already have a seller profile|duplicate|23505/i);
  });

  it("after apply, Nadia can save a draft", async () => {
    const draft = await save(db, BUYER, null, {});
    expect(draft.state).toBe("DRAFT");
    expect(draft.title).toBe("Untitled lot");
    expect(draft.category_slug).toBe("cameras");
    expect(draft.condition).toBe("Good");
    expect(draft.images).toEqual([]);
    expect(num(draft.starting_price)).toBe(1_000_000);
    expect(draft.reserve_price).toBeNull();
    expect(num(draft.shipping_price)).toBe(0);
    expect(draft.sample).toBe(false);
    expect(draft.slug).toMatch(/^untitled-lot/);
  });

  it("Raka save with reserve+images submits; catalogue hides it and has no reserve_price", async () => {
    const draft = await save(db, SELLER, null, {
      title: "Pending review mutation lot",
      category_slug: "watches",
      description: "A fictional development lot used to test seller listing submission.",
      condition: "Excellent",
      images: ["/images/watch.png"],
      starting_price: 2_000_000,
      reserve_price: 5_000_000,
    });
    expect(draft.state).toBe("DRAFT");
    expect(draft.images).toEqual(["/images/watch.png"]);
    expect(num(draft.reserve_price)).toBe(5_000_000);
    const images = await db.db.query<{ storage_path: string; sort_order: number }>(
      "select storage_path, sort_order from public.listing_images where listing_id=$1 order by sort_order",
      [draft.listing_id],
    );
    expect(images.rows).toEqual([{ storage_path: "/images/watch.png", sort_order: 0 }]);

    submitted = await submit(db, SELLER, draft.listing_id);
    expect(submitted.state).toBe("PENDING_REVIEW");
    expect(submitted.slug).toBe(draft.slug);
    expect(num(submitted.reserve_price)).toBe(5_000_000);

    const catalogue = await rpc<{ auctions: Array<{ listing?: { slug?: string } }> }>(db, null, "select public.catalogue() as result");
    expect(catalogue.auctions).toHaveLength(6);
    expect(catalogue.auctions.some((row) => row.listing?.slug === submitted.slug)).toBe(false);
    expect(jsonKeys(catalogue).has("reserve_price")).toBe(false);
  });

  it("listing_editor as Raka returns reserve_price; as Aditya 42501", async () => {
    const body = await editor(db, SELLER, submitted.listing_id);
    expect(num(body.reserve_price)).toBe(5_000_000);
    expect(body.images).toEqual(["/images/watch.png"]);
    await expect(editor(db, RIVAL, submitted.listing_id)).rejects.toThrow(/You cannot access this listing/i);
  });

  it("Aditya cannot save Raka's listing", async () => {
    await expect(save(db, RIVAL, submitted.listing_id, { title: "Hijacked lot" })).rejects.toThrow(
      /A seller profile is required|You do not own this listing/i,
    );
    await expect(save(db, BUYER, submitted.listing_id, { title: "Hijacked lot" })).rejects.toThrow(/You do not own this listing/i);
  });

  it("incomplete submit is rejected", async () => {
    const draft = await save(db, SELLER, null, { title: "Incomplete seller lot" });
    await expect(submit(db, SELLER, draft.listing_id)).rejects.toThrow(/Description must be at least 20 characters/i);
    await save(db, SELLER, draft.listing_id, {
      description: "A sufficiently long description for this listing.",
    });
    await expect(submit(db, SELLER, draft.listing_id)).rejects.toThrow(/At least one image is required/i);
  });

  it("submit of a LIVE fixture is rejected", async () => {
    await expect(submit(db, SELLER, LIVE_LISTING)).rejects.toThrow(/Only draft or rejected listings can be submitted/i);
  });

  it("anon and authenticated still execute only the three private RLS predicates", async () => {
    for (const role of ["anon", "authenticated"]) {
      const result = await db.db.query<{ name: string }>(
        `select p.proname as name from pg_proc p
         join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
         and has_function_privilege($1,p.oid,'EXECUTE') order by p.proname`,
        [role],
      );
      expect(result.rows.map((row) => row.name)).toEqual(["is_admin", "listing_visible", "owns_seller"]);
    }
  });

  it("admin dashboard pending_listings includes the submitted lot", async () => {
    const dash = await rpc<Dashboard>(db, ADMIN, "select public.dashboard() as result");
    expect(dash.pending_listings.some((row) => row.listing?.slug === submitted.slug)).toBe(true);
  });
});
