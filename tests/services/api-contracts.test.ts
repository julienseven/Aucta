import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../../src/lib/server/errors";

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(), callServiceRpc: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn(), requireAdmin: vi.fn(), requireSeller: vi.fn(),
  signInWithOtp: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(),
}));
vi.mock("../../src/lib/server/repository", () => ({ callRpc: mocks.callRpc, callServiceRpc: mocks.callServiceRpc }));
vi.mock("../../src/lib/server/auth", () => ({ requireUser: mocks.requireUser, getCurrentUser: mocks.getCurrentUser, requireAdmin: mocks.requireAdmin, requireSeller: mocks.requireSeller }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({ auth: mocks }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: vi.fn() }) }));

import { POST as bid } from "../../src/app/api/bids/route";
import { POST as watch } from "../../src/app/api/watchlist/route";
import { POST as email } from "../../src/app/api/auth/email/route";
import { POST as google } from "../../src/app/api/auth/google/route";
import { POST as signOut } from "../../src/app/api/auth/sign-out/route";
import { GET as poll } from "../../src/app/api/auctions/[id]/route";
import { POST as applySeller } from "../../src/app/api/seller/route";
import { GET as taxonomy } from "../../src/app/api/taxonomy/route";
import { POST as createListing } from "../../src/app/api/listings/route";
import { GET as listingEditorGet, PATCH as patchListing } from "../../src/app/api/listings/[id]/route";
import { POST as submitListing } from "../../src/app/api/listings/[id]/submit/route";
import { POST as moderateListing } from "../../src/app/api/admin/listings/[id]/route";
import { POST as moderateSeller } from "../../src/app/api/admin/sellers/[id]/route";
import { POST as payOrder } from "../../src/app/api/orders/[id]/pay/route";
import { POST as shipOrder } from "../../src/app/api/orders/[id]/ship/route";
import { POST as receiveOrder } from "../../src/app/api/orders/[id]/receive/route";
import { POST as reviewOrder } from "../../src/app/api/orders/[id]/review/route";
import { POST as upload } from "../../src/app/api/uploads/route";
import { browseAuctions, getAccountData } from "../../src/lib/server/marketplace";

const id = "bbbbbbbb-0000-0000-0000-000000000001";
const user = { id: "00000000-0000-0000-0000-000000000002", name: "Buyer", role: "buyer", local: true };
const seller = { id: "00000000-0000-0000-0000-000000000001", name: "Seller", role: "seller", local: true };
function asSeller() {
  mocks.requireUser.mockResolvedValue(seller);
  mocks.getCurrentUser.mockResolvedValue(seller);
}
const lot = {
  id, starting_price: 1_000_000, current_price: 1_000_000, state: "LIVE", bid_count: 1,
  increment_override: 75_000, starts_at: "2026-09-10T00:00:00Z", ends_at: "2026-09-10T01:00:00Z",
  listing: { id: "listing", slug: "sample-lot", title: "Sample lot", attributes: {} },
  seller: { id: "seller", verified: true },
};
function post(path: string, body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000" + path, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  mocks.requireUser.mockResolvedValue(user);
  mocks.getCurrentUser.mockResolvedValue(user);
  mocks.requireAdmin.mockImplementation(async () => {
    const current = await mocks.getCurrentUser();
    if (!current) throw new ServiceError("Sign in to continue.", 401, "UNAUTHENTICATED");
    if (current.role !== "admin") throw new ServiceError("Administrator access is required.", 403, "FORBIDDEN");
    return current;
  });
  mocks.requireSeller.mockImplementation(async () => {
    const current = await mocks.getCurrentUser();
    if (!current) throw new ServiceError("Sign in to continue.", 401, "UNAUTHENTICATED");
    if (current.role === "buyer") throw new ServiceError("Seller access is required.", 403, "FORBIDDEN");
    return current;
  });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.signInWithOAuth.mockResolvedValue({ data: { url: "https://provider.example/auth" }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("mutation route contracts", () => {
  const body = { auctionId: id, maximum: 1_500_000, idempotencyKey: "aaaaaaaa-0000-0000-0000-000000000001" };
  it("uses the verified server identity and database result for bidding", async () => {
    mocks.callRpc.mockResolvedValue({ is_leading: false, own_maximum: 1_500_000 });
    const response = await bid(post("/api/bids", body));
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("place_bid", { p_auction_id: id, p_maximum: 1_500_000, p_idempotency_key: body.idempotencyKey }, user.id);
    expect(await response.json()).toEqual({ data: { is_leading: false, own_maximum: 1_500_000 } });
  });
  it("blocks unauthenticated and cross-origin requests before the database", async () => {
    mocks.requireUser.mockRejectedValueOnce(new ServiceError("Sign in", 401));
    expect((await bid(post("/api/bids", body))).status).toBe(401);
    expect((await bid(post("/api/bids", body, "https://attacker.example"))).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects fractional money and caller-supplied privileged identity fields", async () => {
    expect((await bid(post("/api/bids", { ...body, maximum: 1.5 }))).status).toBe(400);
    expect((await bid(post("/api/bids", { ...body, userId: "attacker", state: "PAID" }))).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("passes desired watch state so retries cannot toggle it off", async () => {
    mocks.callRpc.mockResolvedValue({ watching: true, watch_count: 1 });
    for (let attempt = 0; attempt < 2; attempt++) expect((await watch(post("/api/watchlist", { auctionId: id, watching: true }))).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenNthCalledWith(1, "set_watch", { p_auction_id: id, p_watching: true }, user.id);
    expect(mocks.callRpc).toHaveBeenNthCalledWith(2, "set_watch", { p_auction_id: id, p_watching: true }, user.id);
  });
});

describe("auction polling and account DTOs", () => {
  it("returns sanitized detail with no caching and only caller-owned private bid data", async () => {
    mocks.callRpc.mockResolvedValue({ auction: { ...lot, reserve_price: 900_000, winning_user_id: "private-id", proxy_bids: [{ maximum: 9_000_000 }] }, own_maximum: 1_500_000, is_leading: true, server_time: "2026-09-10T00:30:00Z", bids: [{ id: "bid", amount: 1_000_000, bidder_alias: "Collector 1", bidder_id: "private-id" }] });
    const response = await poll(new Request("http://localhost/api/auctions/" + id), { params: Promise.resolve({ id }) });
    const body = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.data.auction).toMatchObject({ minimumBid: 1_075_000, ownMaximum: 1_500_000, isLeading: true, serverTime: "2026-09-10T00:30:00Z" });
    expect(JSON.stringify(body)).not.toMatch(/reserve_price|winning_user_id|proxy_bids|bidder_id|private-id/);
  });
  it("does not expose own maximum to a guest and handles missing auctions", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.callRpc.mockResolvedValueOnce({ auction: lot, own_maximum: 1_500_000 });
    const response = await poll(new Request("http://localhost/"), { params: Promise.resolve({ id }) });
    expect((await response.json()).data.auction.ownMaximum).toBeUndefined();
    mocks.callRpc.mockResolvedValueOnce({ auction: null });
    expect((await poll(new Request("http://localhost/"), { params: Promise.resolve({ id }) })).status).toBe(404);
    expect((await poll(new Request("http://localhost/"), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(404);
  });
  it("excludes unpaid winners and failed/refunded orders from the sold archive", async () => {
    mocks.callRpc.mockResolvedValue({ auctions: ["AWAITING_PAYMENT", "PAID", "FULFILLMENT", "COMPLETED", "PAYMENT_FAILED", "REFUNDED"].map(state => ({ ...lot, id: state, state })) });
    expect((await browseAuctions({ status: "sold" })).map(item => item.status)).toEqual(["PAID", "FULFILLMENT", "COMPLETED"]);
  });
  it("deduplicates watched seller auctions and preserves safe notification links", async () => {
    mocks.callRpc.mockImplementation(async (name: string) => name === "catalogue" ? { auctions: [lot] } : {
      auctions: [lot], watchlist: [id], notifications: [
        { id: "safe", type: "outbid", title: "Outbid", message: "Bid again", href: "/auction/sample-lot" },
        { id: "unsafe", type: "outbid", payload: { href: "//attacker.example" } },
      ],
    });
    const account = await getAccountData();
    expect(account.watching).toHaveLength(1);
    expect(account.notifications[0].href).toBe("/auction/sample-lot");
    expect(account.notifications[1].href).toBeUndefined();
  });
});

describe("authentication route contracts", () => {
  it("preserves safe destinations through email and Google provider callbacks", async () => {
    const next = "/auction/sample-lot?tab=bids";
    expect((await email(post("/api/auth/email", { email: "route-test@example.test", next }))).status).toBe(200);
    expect((await google(post("/api/auth/google", { next }))).status).toBe(200);
    const emailUrl = new URL(mocks.signInWithOtp.mock.calls[0][0].options.emailRedirectTo);
    const googleUrl = new URL(mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo);
    for (const url of [emailUrl, googleUrl]) {
      expect(url.origin).toBe("http://localhost:3000");
      expect(url.pathname).toBe("/auth/callback");
      expect(url.searchParams.get("next")).toBe(next);
    }
  });
  it("replaces external redirect destinations with the account page", async () => {
    expect((await google(post("/api/auth/google", { next: "//attacker.example" }))).status).toBe(200);
    expect(new URL(mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo).searchParams.get("next")).toBe("/account");
  });
  it("reports provider sign-out failures instead of claiming success", async () => {
    vi.stubEnv("AUCTA_LOCAL_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.signOut.mockResolvedValue({ error: new Error("Provider failed") });
    const response = await signOut(post("/api/auth/sign-out", {}));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SIGN_OUT_FAILED" });
  });
});

describe("seller listing contracts", () => {
  const draft = { title: "Seiko 6139", images: ["/images/watch.png"] };
  const ctx = { params: Promise.resolve({ id }) };
  it("rejects unauthenticated listing writes", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.requireUser.mockRejectedValueOnce(new ServiceError("Sign in", 401));
    expect((await createListing(post("/api/listings", {}))).status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects buyer listing writes", async () => {
    expect((await createListing(post("/api/listings", {}))).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin seller applications", async () => {
    expect((await applySeller(post("/api/seller", { shopName: "Shop", city: "Jakarta", province: "DKI" }, "https://attacker.example"))).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("saves new drafts without a listing id", async () => {
    asSeller();
    mocks.callRpc.mockResolvedValue({ listing_id: id, state: "DRAFT" });
    expect((await createListing(post("/api/listings", draft))).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("save_listing_draft", { p_listing_id: null, p_payload: expect.any(Object) }, seller.id);
    expect(mocks.callRpc.mock.calls[0][1].p_payload).toMatchObject(draft);
  });
  it("patches drafts with the listing id", async () => {
    asSeller();
    mocks.callRpc.mockResolvedValue({ listing_id: id, state: "DRAFT" });
    const request = new Request("http://localhost:3000/api/listings/" + id, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(draft) });
    expect((await patchListing(request, ctx)).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("save_listing_draft", { p_listing_id: id, p_payload: expect.any(Object) }, seller.id);
  });
  it("submits listings by id", async () => {
    asSeller();
    mocks.callRpc.mockResolvedValue({ listing_id: id, state: "PENDING_REVIEW" });
    const request = new Request("http://localhost:3000/api/listings/" + id + "/submit", { method: "POST", headers: { origin: "http://localhost:3000" } });
    expect((await submitListing(request, ctx)).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("submit_listing", { p_listing_id: id }, seller.id);
  });
  it("loads taxonomy without a session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.requireUser.mockRejectedValue(new ServiceError("Sign in", 401));
    mocks.callRpc.mockResolvedValue({ categories: [{ id: "cat", slug: "watches", name: "Watches" }] });
    const response = await taxonomy();
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("taxonomy", {});
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ data: { categories: [{ id: "cat", slug: "watches", name: "Watches" }] } });
  });
  it("loads the listing editor for the signed-in owner", async () => {
    mocks.callRpc.mockResolvedValue({
      listing_id: id, auction_id: "aaaaaaaa-0000-0000-0000-000000000001", slug: "draft-lot", state: "DRAFT",
      title: "Draft lot", category_slug: "watches", brand: "Seiko", description: "A watch", condition: "Good",
      flaws: "", provenance: "", attributes: {}, images: ["/images/watch.png"], starting_price: 1_000_000,
      reserve_price: 2_000_000, increment_override: null, starts_at: "2026-09-10T00:00:00Z", ends_at: "2026-09-10T01:00:00Z",
      shipping_price: 0, sample: false,
    });
    const response = await listingEditorGet(new Request("http://localhost:3000/api/listings/" + id), ctx);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("listing_editor", { p_listing_id: id }, user.id);
    expect(body.data.reservePrice).toBe(2_000_000);
    expect(JSON.stringify(body)).not.toMatch(/reserve_price/);
  });
  it("does not store uploads outside local mode", async () => {
    vi.stubEnv("AUCTA_LOCAL_MODE", "false");
    const response = await upload(new Request("http://localhost:3000/api/uploads", { method: "POST", headers: { origin: "http://localhost:3000" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "NOT_CONFIGURED" });
  });
});

describe("admin moderation contracts", () => {
  const admin = { id: "00000000-0000-0000-0000-000000000004", name: "Admin", role: "admin", local: true };
  const ctx = { params: Promise.resolve({ id }) };
  const reason = "Looks complete and compliant.";
  const body = { decision: "approve" as const, reason };
  function asAdmin() {
    mocks.requireAdmin.mockResolvedValue(admin);
    mocks.getCurrentUser.mockResolvedValue(admin);
  }

  it("approves listings through moderate_listing", async () => {
    asAdmin();
    mocks.callRpc.mockResolvedValue({ listing_id: id, state: "LIVE" });
    const response = await moderateListing(post("/api/admin/listings/" + id, body), ctx);
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("moderate_listing", { p_listing_id: id, p_decision: "approve", p_reason: reason }, admin.id);
    expect(await response.json()).toEqual({ data: { listing_id: id, state: "LIVE" } });
  });
  it("rejects buyer listing moderation", async () => {
    expect((await moderateListing(post("/api/admin/listings/" + id, body), ctx)).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated listing moderation", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await moderateListing(post("/api/admin/listings/" + id, body), ctx)).status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin listing moderation", async () => {
    asAdmin();
    expect((await moderateListing(post("/api/admin/listings/" + id, body, "https://attacker.example"), ctx)).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects privileged extra fields on listing moderation", async () => {
    asAdmin();
    expect((await moderateListing(post("/api/admin/listings/" + id, { ...body, state: "LIVE", userId: "x" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects missing or short listing moderation reasons", async () => {
    asAdmin();
    expect((await moderateListing(post("/api/admin/listings/" + id, { decision: "approve" }), ctx)).status).toBe(400);
    expect((await moderateListing(post("/api/admin/listings/" + id, { decision: "approve", reason: "short" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects invalid listing ids", async () => {
    asAdmin();
    expect((await moderateListing(post("/api/admin/listings/invalid", body), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(404);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("approves sellers through moderate_seller", async () => {
    asAdmin();
    mocks.callRpc.mockResolvedValue({ seller_id: id, verification_status: "VERIFIED" });
    const response = await moderateSeller(post("/api/admin/sellers/" + id, body), ctx);
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("moderate_seller", { p_seller_id: id, p_decision: "approve", p_reason: reason }, admin.id);
    expect(await response.json()).toEqual({ data: { seller_id: id, verification_status: "VERIFIED" } });
  });
  it("rejects buyer seller moderation", async () => {
    expect((await moderateSeller(post("/api/admin/sellers/" + id, body), ctx)).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated seller moderation", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await moderateSeller(post("/api/admin/sellers/" + id, body), ctx)).status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin seller moderation", async () => {
    asAdmin();
    expect((await moderateSeller(post("/api/admin/sellers/" + id, body, "https://attacker.example"), ctx)).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects privileged extra fields on seller moderation", async () => {
    asAdmin();
    expect((await moderateSeller(post("/api/admin/sellers/" + id, { ...body, state: "LIVE", userId: "x" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects missing or short seller moderation reasons", async () => {
    asAdmin();
    expect((await moderateSeller(post("/api/admin/sellers/" + id, { decision: "approve" }), ctx)).status).toBe(400);
    expect((await moderateSeller(post("/api/admin/sellers/" + id, { decision: "approve", reason: "short" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects invalid seller ids", async () => {
    asAdmin();
    expect((await moderateSeller(post("/api/admin/sellers/invalid", body), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(404);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
});

describe("order mutation contracts", () => {
  const ctx = { params: Promise.resolve({ id }) };
  const attacker = "https://attacker.example";
  const payKey = "aaaaaaaa-0000-0000-0000-000000000001";
  const pay = { idempotencyKey: payKey };
  const shipment = { carrier: "JNE YES", trackingNumber: "JNE12345678" };
  const review = { rating: 5, text: "Packed well and as described." };

  it("pays through pay_order with the verified user", async () => {
    mocks.callRpc.mockResolvedValue({ order_id: id, state: "PAID" });
    const response = await payOrder(post("/api/orders/" + id + "/pay", pay), ctx);
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("pay_order", { p_order_id: id, p_idempotency_key: payKey }, user.id);
    expect(await response.json()).toEqual({ data: { order_id: id, state: "PAID" } });
  });
  it("rejects missing or short pay idempotency keys", async () => {
    expect((await payOrder(post("/api/orders/" + id + "/pay", {}), ctx)).status).toBe(400);
    expect((await payOrder(post("/api/orders/" + id + "/pay", { idempotencyKey: "short" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects invalid order ids", async () => {
    const invalid = { params: Promise.resolve({ id: "invalid" }) };
    expect((await payOrder(post("/api/orders/invalid/pay", pay), invalid)).status).toBe(404);
    expect((await shipOrder(post("/api/orders/invalid/ship", shipment), invalid)).status).toBe(404);
    expect((await receiveOrder(post("/api/orders/invalid/receive", {}), invalid)).status).toBe(404);
    expect((await reviewOrder(post("/api/orders/invalid/review", review), invalid)).status).toBe(404);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin order mutations before the database", async () => {
    expect((await payOrder(post("/api/orders/" + id + "/pay", pay, attacker), ctx)).status).toBe(403);
    expect((await shipOrder(post("/api/orders/" + id + "/ship", shipment, attacker), ctx)).status).toBe(403);
    expect((await receiveOrder(post("/api/orders/" + id + "/receive", {}, attacker), ctx)).status).toBe(403);
    expect((await reviewOrder(post("/api/orders/" + id + "/review", review, attacker), ctx)).status).toBe(403);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated order mutations", async () => {
    mocks.requireUser.mockRejectedValueOnce(new ServiceError("Sign in", 401));
    expect((await payOrder(post("/api/orders/" + id + "/pay", pay), ctx)).status).toBe(401);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("rejects privileged extra fields on pay, ship, and review", async () => {
    expect((await payOrder(post("/api/orders/" + id + "/pay", { ...pay, userId: "x", state: "PAID" }), ctx)).status).toBe(400);
    expect((await shipOrder(post("/api/orders/" + id + "/ship", { ...shipment, tracking: "x" }), ctx)).status).toBe(400);
    expect((await reviewOrder(post("/api/orders/" + id + "/review", { rating: 5, body: review.text }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("ships through ship_order", async () => {
    mocks.callRpc.mockResolvedValue({ order_id: id, state: "SHIPPED" });
    const response = await shipOrder(post("/api/orders/" + id + "/ship", shipment), ctx);
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("ship_order", { p_order_id: id, p_carrier: "JNE YES", p_tracking: "JNE12345678" }, user.id);
  });
  it("rejects invalid shipment tracking", async () => {
    expect((await shipOrder(post("/api/orders/" + id + "/ship", { carrier: "JNE YES", trackingNumber: "ab" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("confirms receipt through confirm_received", async () => {
    mocks.callRpc.mockResolvedValue({ order_id: id, state: "RECEIVED" });
    const response = await receiveOrder(post("/api/orders/" + id + "/receive", {}), ctx);
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("confirm_received", { p_order_id: id }, user.id);
  });
  it("confirms receipt without a JSON body", async () => {
    mocks.callRpc.mockResolvedValue({ order_id: id, state: "RECEIVED" });
    const request = new Request("http://localhost:3000/api/orders/" + id + "/receive", { method: "POST", headers: { origin: "http://localhost:3000" } });
    expect((await receiveOrder(request, ctx)).status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("confirm_received", { p_order_id: id }, user.id);
  });
  it("rejects extra keys on receive JSON", async () => {
    expect((await receiveOrder(post("/api/orders/" + id + "/receive", { extra: true }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
  it("reviews through review_order", async () => {
    mocks.callRpc.mockResolvedValue({ order_id: id, rating: 5 });
    const response = await reviewOrder(post("/api/orders/" + id + "/review", review), ctx);
    expect(response.status).toBe(200);
    expect(mocks.callRpc).toHaveBeenCalledWith("review_order", { p_order_id: id, p_rating: 5, p_body: "Packed well and as described." }, user.id);
  });
  it("rejects invalid review ratings and short text", async () => {
    expect((await reviewOrder(post("/api/orders/" + id + "/review", { rating: 0, text: "Packed well." }), ctx)).status).toBe(400);
    expect((await reviewOrder(post("/api/orders/" + id + "/review", { rating: 5, text: "x" }), ctx)).status).toBe(400);
    expect(mocks.callRpc).not.toHaveBeenCalled();
  });
});
