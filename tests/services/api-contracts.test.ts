import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "../../src/lib/server/errors";

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(), callServiceRpc: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn(),
  signInWithOtp: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(),
}));
vi.mock("../../src/lib/server/repository", () => ({ callRpc: mocks.callRpc, callServiceRpc: mocks.callServiceRpc }));
vi.mock("../../src/lib/server/auth", () => ({ requireUser: mocks.requireUser, getCurrentUser: mocks.getCurrentUser, requireAdmin: mocks.requireUser }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: async () => ({ auth: mocks }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: vi.fn() }) }));

import { POST as bid } from "../../src/app/api/bids/route";
import { POST as watch } from "../../src/app/api/watchlist/route";
import { POST as email } from "../../src/app/api/auth/email/route";
import { POST as google } from "../../src/app/api/auth/google/route";
import { POST as signOut } from "../../src/app/api/auth/sign-out/route";
import { GET as poll } from "../../src/app/api/auctions/[id]/route";
import { browseAuctions, getAccountData } from "../../src/lib/server/marketplace";

const id = "bbbbbbbb-0000-0000-0000-000000000001";
const user = { id: "00000000-0000-0000-0000-000000000002", name: "Buyer", role: "buyer", local: true };
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
