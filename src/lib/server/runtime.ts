import { ServiceError } from "./errors";

type Environment = Record<string, string | undefined>;

export function isLoopbackHost(value: string | null | undefined): boolean {
  if (!value || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(value)) return false;
  try {
    const hostname = new URL(`http://${value}`).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch { return false; }
}

export function localRuntimeEnabled(env: Environment = process.env): boolean {
  if (env.AUCTA_LOCAL_MODE !== "true" || env.VERCEL || env.NETLIFY || env.CF_PAGES || env.AWS_LAMBDA_FUNCTION_NAME || env.RENDER || env.RAILWAY_ENVIRONMENT) return false;
  try {
    const url = new URL(env.APP_URL ?? "");
    return (url.protocol === "http:" || url.protocol === "https:") && isLoopbackHost(url.host);
  } catch { return false; }
}

function loopbackAddress(value: string): boolean {
  const host = value.trim().replace(/^\[|\]$/g, "").toLowerCase();
  return host === "127.0.0.1" || host === "::1" || host === "::ffff:127.0.0.1" || isLoopbackHost(host);
}

/** Next may set Forwarded on loopback. Reject it only when any hop is not loopback. */
function forwardedLoopback(value: string): boolean {
  const hosts = [...value.matchAll(/(?:^|[;,]\s*)host="?([^;,"\s]+)"?/gi)].map((match) => match[1]);
  const peers = [...value.matchAll(/(?:^|[;,]\s*)for="?\[?([^;,"\s\]]+)"?/gi)].map((match) => match[1]);
  if (hosts.length === 0 && peers.length === 0) return false;
  return hosts.every((host) => isLoopbackHost(host)) && peers.every(loopbackAddress);
}

export function localRequestEnabled(requestHeaders: Pick<Headers, "get">, env: Environment = process.env): boolean {
  if (!localRuntimeEnabled(env) || !isLoopbackHost(requestHeaders.get("host"))) return false;
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedHost && !isLoopbackHost(forwardedHost)) return false;
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor && !forwardedFor.split(",").every(loopbackAddress)) return false;
  const forwarded = requestHeaders.get("forwarded");
  if (forwarded && !forwardedLoopback(forwarded)) return false;
  return true;
}

export function supabaseConfigured(env: Environment = process.env): boolean {
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || /your[-_ ]|placeholder/i.test(key)) return false;
  try { return new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").protocol === "https:"; } catch { return false; }
}

export function serviceRoleConfigured(env: Environment = process.env): boolean {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return supabaseConfigured(env) && Boolean(key && key.length >= 32 && !/your[-_ ]|placeholder/i.test(key));
}

export function requireLocalRequest(requestHeaders: Pick<Headers, "get">): void {
  if (!localRequestEnabled(requestHeaders)) throw new ServiceError("Local development identities are available only on this computer in explicit local mode.", 403, "LOCAL_ONLY");
}

export function applicationOrigin(): string {
  try {
    const url = new URL(process.env.APP_URL ?? "");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.host))) throw new Error("invalid");
    return url.origin;
  } catch { throw new ServiceError("Application origin is not configured.", 503, "NOT_CONFIGURED"); }
}

export function safeReturnPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return fallback;
  return value;
}
