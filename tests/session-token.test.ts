import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

const SECRET = "test-secret-value";

describe("session tokens", () => {
  it("rejects expired and future-dated tokens", () => {
    expect(verifySessionToken(createSessionToken("user-123", SECRET, Date.now() - 30 * 24 * 60 * 60_000), SECRET)).toBeNull();
    expect(verifySessionToken(createSessionToken("user-123", SECRET, Date.now() + 120_000), SECRET)).toBeNull();
  });
  it("round-trips a user id", () => {
    const token = createSessionToken("user-123", SECRET);
    expect(verifySessionToken(token, SECRET)).toBe("user-123");
  });

  it("rejects tampered payloads", () => {
    const token = createSessionToken("user-123", SECRET);
    const [payload, mac] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ uid: "user-999", n: Date.now() }),
    ).toString("base64url");
    expect(verifySessionToken(`${forged}.${mac}`, SECRET)).toBeNull();
    expect(verifySessionToken(`${payload}.${mac.slice(0, -1)}${mac.endsWith("A") ? "B" : "A"}`, SECRET)).toBeNull();
  });

  it("rejects tokens signed with another secret", () => {
    const token = createSessionToken("user-123", SECRET);
    expect(verifySessionToken(token, "attacker-secret")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySessionToken("garbage", SECRET)).toBeNull();
    expect(verifySessionToken("", SECRET)).toBeNull();
    expect(verifySessionToken("a.b.c", SECRET)).toBeNull();
  });
});
