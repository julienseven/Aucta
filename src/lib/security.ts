/* Security primitives shared by auth and financial routes.
   No framework imports here so the pure helpers are unit-testable. */

/* Open-redirect guard: only same-origin paths starting with a single slash. */
export function safeRedirect(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://")) return fallback;
  // Keep paths and query strings, reject control characters / newlines.
  if (/[\r\n\t]/.test(value)) return fallback;
  return value;
}

/* -------------------- In-memory sliding-window rate limiter -------------------- */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export type RateResult = { ok: boolean; limit: number; remaining: number; retryAfter: number };

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, limit: opts.limit, remaining: opts.limit - 1, retryAfter: 0 };
  }
  existing.count += 1;
  const ok = existing.count <= opts.limit;
  return {
    ok,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - existing.count),
    retryAfter: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/* Periodic cleanup so the map cannot grow unbounded. */
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }, 60_000);
  // Don't keep the process alive solely for cleanup.
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
}

/* -------------------- Idempotency (single-process preview) -------------------- */
type CachedResult = { status: number; body: unknown; at: number };
const idemStore = new Map<string, CachedResult>();
const IDEM_TTL = 10 * 60_000;

export function getIdempotent(key: string): CachedResult | null {
  const hit = idemStore.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > IDEM_TTL) {
    idemStore.delete(key);
    return null;
  }
  return hit;
}

export function setIdempotent(key: string, status: number, body: unknown): void {
  idemStore.set(key, { status, body, at: Date.now() });
  if (idemStore.size > 5000) {
    const oldest = [...idemStore.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) idemStore.delete(oldest);
  }
}

/* Client IP for rate-limit keys (tolerates simple proxies). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}
