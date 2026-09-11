import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin, safeReturnPath } from "@/lib/server/runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const token = url.searchParams.get("token_hash");
    if (token && url.searchParams.get("type") === "email") {
      const client = await createClient();
      const { error } = await client.auth.verifyOtp({ token_hash: token, type: "email" });
      if (!error) return NextResponse.redirect(new URL(safeReturnPath(url.searchParams.get("next")), applicationOrigin()));
    }
  } catch { /* Do not expose tokens or authentication internals. */ }
  return NextResponse.redirect(new URL("/sign-in?error=confirmation", applicationOrigin()));
}
