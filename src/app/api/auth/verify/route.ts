import { NextResponse } from "next/server";
import {
  consumeAuthCredential,
  setSessionCookie,
} from "@/lib/auth";
import { safeRedirect, rateLimit, clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limiter = rateLimit(`auth-verify:${clientIp(req)}`, { limit: 30, windowMs: 15 * 60_000 });
  if (!limiter.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const credential = String(body?.credential ?? "").trim();
  const next = safeRedirect(body?.next, "/account");
  if (!credential) {
    return NextResponse.json(
      { error: "Enter the 6-digit code or open the link in your email.", code: "MISSING" },
      { status: 400 },
    );
  }

  const result = await consumeAuthCredential(credential, String(body?.email ?? "")).catch(() => ({ error: "Sign-in is temporarily unavailable." }));

  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: "INVALID" }, { status: 401 });
  }

  await setSessionCookie(result.id);
  return NextResponse.json({
    ok: true,
    next,
    user: { id: result.id, email: result.email, alias: result.alias, role: result.role },
  });
}
