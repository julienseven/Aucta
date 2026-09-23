import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { isLocalDemo } from "@/lib/runtime";
import { authTokens, users, type UserRow } from "@/db/schema";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  createSessionToken as signSession,
  verifySessionToken,
} from "@/lib/session-token";

export const SESSION_COOKIE = "aucta_session";
function sessionSecret(): string {
  const secret = process.env.AUCTA_SECRET;
  if (!secret || secret.length < 32 || secret === "aucta-preview-secret-change-me") throw new Error("AUCTA_SECRET must contain at least 32 random characters");
  return secret;
}
export function localDemoEnabled(): boolean {
  return isLocalDemo();
}
export const AUTH_CODE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export function createSessionToken(userId: string): string {
  return signSession(userId, sessionSecret());
}

function verifyToken(token: string): string | null {
  return verifySessionToken(token, sessionSecret());
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/" as const,
    maxAge,
  };
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userId), cookieOptions(60 * 60 * 24 * 30));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = verifyToken(token);
  if (!uid) return null;
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  if (user.suspended) return null; // suspended sessions are rejected
  return user;
}

/* ----------------------------- Magic link / OTP ----------------------------- */

export type IssuedAuth = {
  token: string;
  code: string;
  expiresAt: Date;
  email: string;
  userId: string | null;
};

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function issueAuthToken(emailInput: string): Promise<IssuedAuth> {
  const email = emailInput.trim().toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const token = randomBytes(32).toString("base64url");
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    const recent = await tx.select({ id: authTokens.id }).from(authTokens)
      .where(and(eq(authTokens.email, email), gt(authTokens.createdAt, new Date(Date.now() - AUTH_CODE_TTL_MS))));
    if (recent.length >= 5) throw new Error("AUTH_RATE_LIMITED");
    await tx.update(authTokens).set({ consumedAt: new Date() })
      .where(and(eq(authTokens.email, email), isNull(authTokens.consumedAt)));
    await tx.insert(authTokens).values({ email, userId: existing[0]?.id ?? null,
      tokenHash: hashValue(token), codeHash: hashValue(code), expiresAt });
  });

  return {
    token,
    code,
    expiresAt,
    email,
    userId: existing[0]?.id ?? null,
  };
}

export async function consumeAuthCredential(
  credentialInput: string,
  emailInput?: string,
): Promise<UserRow | { error: string }> {
  const credential = credentialInput.trim();
  const isCode = /^\d{6}$/.test(credential);
  const email = emailInput?.trim().toLowerCase();
  const invalid = { error: "Invalid or expired sign-in credential." };
  if (isCode && !email) return invalid;
  if (!isCode && !/^[A-Za-z0-9_-]{43}$/.test(credential)) return invalid;
  const hash = hashValue(credential);
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(authTokens)
      .where(and(isCode ? eq(authTokens.email, email!) : eq(authTokens.tokenHash, hash),
        isNull(authTokens.consumedAt), gt(authTokens.expiresAt, new Date())))
      .orderBy(desc(authTokens.createdAt)).limit(1).for("update");
    if (!record || record.attempts >= 5) return invalid;
    const matches = timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(isCode ? record.codeHash : record.tokenHash, "hex"));
    if (!matches) {
      await tx.update(authTokens).set({ attempts: record.attempts + 1,
        consumedAt: record.attempts + 1 >= 5 ? new Date() : null,
      }).where(eq(authTokens.id, record.id));
      return invalid;
    }
    let [user] = await tx.select().from(users).where(eq(users.email, record.email)).limit(1);
    if (!user) {
      await tx.insert(users).values({ email: record.email, alias: `collector*${randomBytes(8).toString("hex")}`, provider: "email" }).onConflictDoNothing();
      [user] = await tx.select().from(users).where(eq(users.email, record.email)).limit(1);
    }
    if (!user) throw new Error("Unable to create account");
    await tx.update(authTokens).set({ consumedAt: new Date(), userId: user.id }).where(eq(authTokens.id, record.id));
    return user.suspended ? { error: "This account is suspended." } : user;
  });
}

const aliasWords = [
  "merak",
  "garuda",
  "bamboo",
  "raden",
  "celuluk",
  "topeng",
  "batik",
  "cendana",
  "lontar",
  "teak",
  "sandalwood",
  "banyan",
  "tropical",
  "jasmine",
  "komodo",
];

export function generateAlias(existing: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const word = aliasWords[Math.floor(Math.random() * aliasWords.length)];
    const nums = Math.floor(1000 + Math.random() * 9000);
    const alias = `${word}*${nums}`;
    if (!existing.has(alias)) return alias;
  }
  return `collector*${randomBytes(3).toString("hex").slice(0, 6)}`;
}

export async function findOrCreateUser(input: {
  email: string;
  provider?: "email" | "google";
  displayName?: string | null;
  googleSub?: string | null;
}): Promise<UserRow> {
  const email = input.email.trim().toLowerCase();
  const provider = input.provider ?? "email";

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) return existing[0];

  const all = await db.select({ alias: users.alias }).from(users);
  const alias = generateAlias(new Set(all.map((a) => a.alias)));
  const rows = await db
    .insert(users)
    .values({
      email,
      alias,
      provider,
      displayName: input.displayName ?? null,
    })
    .returning();
  return rows[0];
}
