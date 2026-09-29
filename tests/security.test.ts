import { describe, expect, it } from "vitest";
import {
  getIdempotent,
  isSameOriginRequest,
  rateLimit,
  safeRedirect,
  setIdempotent,
} from "@/lib/security";

describe("safeRedirect", () => {
  it("allows same-origin paths", () => {
    expect(safeRedirect("/account", "/")).toBe("/account");
    expect(safeRedirect("/checkout/x?a=1", "/")).toBe("/checkout/x?a=1");
  });
  it("blocks open redirects", () => {
    expect(safeRedirect("https://evil.com", "/")).toBe("/");
    expect(safeRedirect("//evil.com", "/")).toBe("/");
    expect(safeRedirect("/\\evil.com", "/")).toBe("/");
    expect(safeRedirect("https://good.com@evil.com", "/")).toBe("/");
  });
  it("falls back safely", () => {
    expect(safeRedirect(null, "/auctions")).toBe("/auctions");
    expect(safeRedirect("", "/")).toBe("/");
  });
});

describe("same-origin request guard", () => {
  const request = (origin?: string) => new Request("https://aucta.example/api/admin", {
    method: "POST",
    headers: origin ? { origin } : undefined,
  });

  it("allows matching serialized origins", () => {
    expect(isSameOriginRequest(request("https://aucta.example"))).toBe(true);
  });
  it("rejects hostile, malformed, and missing origins", () => {
    expect(isSameOriginRequest(request("https://evil.example"))).toBe(false);
    expect(isSameOriginRequest(request("null"))).toBe(false);
    expect(isSameOriginRequest(request("https://aucta.example/path"))).toBe(false);
    expect(isSameOriginRequest(request())).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks until the window rolls", () => {
    const key = `rl-${Math.random()}`;
    const first = rateLimit(key, { limit: 3, windowMs: 60_000 });
    rateLimit(key, { limit: 3, windowMs: 60_000 });
    const third = rateLimit(key, { limit: 3, windowMs: 60_000 });
    const fourth = rateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(first.ok).toBe(true);
    expect(third.ok).toBe(true);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfter).toBeGreaterThan(0);
  });
});

describe("idempotency cache", () => {
  it("returns the stored response for a repeated key", () => {
    const key = `idem-${Math.random()}`;
    expect(getIdempotent(key)).toBeNull();
    setIdempotent(key, 200, { ok: true });
    expect(getIdempotent(key)?.body).toEqual({ ok: true });
  });
});
