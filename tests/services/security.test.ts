import { describe, expect, it } from "vitest";
import { signLocalSession, verifyLocalSession } from "../../src/lib/server/local-session";
import { isLoopbackHost, localRequestEnabled, localRuntimeEnabled, safeReturnPath, supabaseConfigured } from "../../src/lib/server/runtime";
import { enforceRateLimit, enforceSameOrigin, readJson, uuid } from "../../src/lib/server/http";

describe("request identifiers", () => {
  it("accepts PostgreSQL uuids used by local seed identities", () => {
    expect(uuid.parse("bbbbbbbb-0000-0000-0000-000000000001")).toBe("bbbbbbbb-0000-0000-0000-000000000001");
    expect(uuid.parse("00000000-0000-0000-0000-000000000002")).toBe("00000000-0000-0000-0000-000000000002");
    expect(() => uuid.parse("not-a-uuid")).toThrow();
  });
});

describe("local identities fail closed", () => {
  const env = { AUCTA_LOCAL_MODE: "true", APP_URL: "http://localhost:3000" };
  it("requires explicit local mode and a loopback application origin", () => {
    expect(localRuntimeEnabled({})).toBe(false);
    expect(localRuntimeEnabled(env)).toBe(true);
    expect(localRuntimeEnabled({ ...env, APP_URL: "https://aucta.example" })).toBe(false);
    for (const marker of ["VERCEL", "NETLIFY", "CF_PAGES", "AWS_LAMBDA_FUNCTION_NAME", "RENDER", "RAILWAY_ENVIRONMENT"]) expect(localRuntimeEnabled({ ...env, [marker]: "1" })).toBe(false);
  });
  it("rejects spoofed, forwarded and public hostnames", () => {
    for (const host of ["localhost.evil.com", "localhost@evil.com", "evil.com", "127.0.0.2", "localhost/path", "localhost\\evil", "localhost?attacker", "localhost#attacker", "2130706433", "127.1", "localhost:65536"]) expect(isLoopbackHost(host)).toBe(false);
    expect(localRequestEnabled(new Headers({ host: "localhost:3000" }), env)).toBe(true);
    expect(localRequestEnabled(new Headers({ host: "localhost:3000", forwarded: "for=127.0.0.1;host=localhost:3000;proto=http" }), env)).toBe(true);
    expect(localRequestEnabled(new Headers({ host: "localhost:3000", "x-forwarded-host": "aucta.example" }), env)).toBe(false);
    expect(localRequestEnabled(new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.1" }), env)).toBe(false);
    expect(localRequestEnabled(new Headers({ host: "localhost:3000", forwarded: "for=203.0.113.1;host=localhost:3000" }), env)).toBe(false);
  });
  it("rejects altered, expired and incorrectly signed session cookies", () => {
    const secret = "a-secure-test-only-secret-with-32-plus-characters";
    const cookie = signLocalSession("buyer", secret, 1_000_000);
    expect(verifyLocalSession(cookie, secret, 1_000_001)).toBe("buyer");
    expect(verifyLocalSession(cookie, secret + "x", 1_000_001)).toBeNull();
    expect(verifyLocalSession(cookie.replace(/.$/, "!"), secret, 1_000_001)).toBeNull();
    expect(verifyLocalSession(cookie, secret, 1_000_000 + 8 * 60 * 60 * 1000)).toBeNull();
    expect(() => signLocalSession("admin", "short")).toThrow();
  });
  it("does not treat placeholder config or attacker redirects as trusted", () => {
    expect(supabaseConfigured({ NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "your-key" })).toBe(false);
    expect(safeReturnPath("//evil.example")).toBe("/account");
    expect(safeReturnPath("/\\evil.example")).toBe("/account");
    expect(safeReturnPath("/selling")).toBe("/selling");
    expect(safeReturnPath("/\t/evil.example")).toBe("/account");
    expect(safeReturnPath("/\u0000/evil.example")).toBe("/account");
  });
});

describe("request defenses", () => {
  it("rejects requests without same-origin proof", () => {
    const previous = process.env.APP_URL;
    process.env.APP_URL = "http://localhost:3000";
    try {
      expect(() => enforceSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST" }))).toThrow();
      expect(() => enforceSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin: "https://evil.example" } }))).toThrow();
      expect(() => enforceSameOrigin(new Request("http://localhost:3000/api/test", { method: "POST", headers: { origin: "http://localhost:3000" } }))).not.toThrow();
    } finally { if (previous === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous; }
  });
  it("bounds rate windows", () => {
    enforceRateLimit("test-rate-window", 1, 60_000, 100);
    expect(() => enforceRateLimit("test-rate-window", 1, 60_000, 101)).toThrow();
    expect(() => enforceRateLimit("test-rate-window", 1, 60_000, 60_100)).not.toThrow();
  });
  it("rejects oversized streaming input and invalid identifiers", async () => {
    await expect(readJson(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify("x".repeat(64_000)) }), uuid)).rejects.toThrow("large");
    await expect(readJson(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: '"invalid"' }), uuid)).rejects.toThrow();
  });
});
