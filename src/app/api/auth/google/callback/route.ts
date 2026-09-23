import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findOrCreateUser, setSessionCookie } from "@/lib/auth";
import { safeRedirect } from "@/lib/security";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get("aucta_oauth_state")?.value;
  const next = safeRedirect(jar.get("aucta_oauth_next")?.value, "/account");
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(reason)}`, url.origin));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !state || !expectedState || state !== expectedState || !clientId) {
    return fail("oauth_state");
  }

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret ?? "",
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google_token");
    const token = await tokenRes.json();

    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    if (!userRes.ok) return fail("google_userinfo");
    const profile = await userRes.json();
    if (!profile?.email || profile.email_verified !== true) return fail("google_email");

    const user = await findOrCreateUser({
      email: profile.email as string,
      provider: "google",
      displayName: (profile.name as string) ?? null,
      googleSub: (profile.sub as string) ?? null,
    });
    if (user.suspended) return fail("account_suspended");
    await setSessionCookie(user.id);
    jar.delete("aucta_oauth_state");
    jar.delete("aucta_oauth_next");
    return NextResponse.redirect(new URL(next, url.origin));
  } catch (err) {
    logger.error("google_oauth_failed", { error: String(err) });
    return fail("google_error");
  }
}
