import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/* Stateless signed session tokens. Framework-free so the crypto can be unit
   tested independently of Next.js cookie APIs.
   Format: base64url(payload).base64url(HMAC-SHA256(payload)) */

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  userId: string,
  secret: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, n: now }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifySessionToken(
  token: string,
  secret: string,
): string | null {
  if (typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!payload || !mac) return null;

  const expected = signPayload(payload, secret);
  // Length guard plus constant-time digest comparison.
  if (expected.length !== mac.length || !safeEqualHex(expected, mac)) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { uid?: string; n?: number };
    if (typeof data.n !== "number" || !Number.isFinite(data.n) || data.n > Date.now() + 60_000 || Date.now() - data.n >= 30 * 24 * 60 * 60_000) return null;
    return typeof data.uid === "string" && data.uid ? data.uid : null;
  } catch {
    return null;
  }
}
