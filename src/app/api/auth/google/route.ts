import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { safeRedirect } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeRedirect(url.searchParams.get("next"), "/account");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;

  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=google_unavailable`, url.origin),
    );
  }

  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("aucta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  jar.set("aucta_oauth_next", next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set(
    "redirect_uri",
    `${base}/api/auth/google/callback`,
  );
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("access_type", "online");

  return NextResponse.redirect(auth);
}
