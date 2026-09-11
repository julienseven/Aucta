import { createHmac, timingSafeEqual } from "node:crypto";

export const LOCAL_COOKIE = "aucta_local_session";
export const LOCAL_IDENTITIES = {
  seller: { id: "00000000-0000-0000-0000-000000000001", name: "Raka Studio", email: "seller@aucta.local" },
  buyer: { id: "00000000-0000-0000-0000-000000000002", name: "Nadia", email: "buyer@aucta.local" },
  rival: { id: "00000000-0000-0000-0000-000000000003", name: "Aditya", email: "competitor@aucta.local" },
  admin: { id: "00000000-0000-0000-0000-000000000004", name: "Admin", email: "admin@aucta.local" },
} as const;
export type LocalIdentity = keyof typeof LOCAL_IDENTITIES;

function key(secret: string | undefined): string {
  if (!secret || secret.length < 32) throw new Error("LOCAL_AUTH_SECRET must contain at least 32 characters.");
  return secret;
}

export function signLocalSession(identity: LocalIdentity, secret = process.env.LOCAL_AUTH_SECRET, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ identity, exp: Math.floor(now / 1000) + 8 * 60 * 60 })).toString("base64url");
  return `${payload}.${createHmac("sha256", key(secret)).update(payload).digest("base64url")}`;
}

export function verifyLocalSession(value: string | undefined, secret = process.env.LOCAL_AUTH_SECRET, now = Date.now()): LocalIdentity | null {
  if (!value || value.length > 1024 || !secret || secret.length < 32) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", key(secret)).update(parts[0]).digest();
  const provided = Buffer.from(parts[1], "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!Number.isInteger(parsed.exp) || parsed.exp <= Math.floor(now / 1000) || parsed.exp > Math.floor(now / 1000) + 8 * 60 * 60) return null;
    return Object.hasOwn(LOCAL_IDENTITIES, parsed.identity) ? parsed.identity as LocalIdentity : null;
  } catch { return null; }
}
