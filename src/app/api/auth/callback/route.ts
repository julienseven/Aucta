import { NextResponse } from "next/server";
import {
  consumeAuthCredential,
  setSessionCookie,
} from "@/lib/auth";
import { safeRedirect } from "@/lib/security";

export const dynamic = "force-dynamic";

/* Magic-link destination: verifies the token, sets the session cookie and
   redirects to a validated same-origin path. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeRedirect(url.searchParams.get("next"), "/account");

  const result = await consumeAuthCredential(token);
  const origin = url.origin;

  if ("error" in result) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(result.error)}`, origin),
    );
  }

  await setSessionCookie(result.id);
  return NextResponse.redirect(new URL(next, origin));
}
