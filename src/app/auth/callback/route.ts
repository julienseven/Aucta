import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin, safeReturnPath } from "@/lib/server/runtime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL(safeReturnPath(url.searchParams.get("next")), applicationOrigin());
  try {
    const code = url.searchParams.get("code");
    if (code) {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(target);
    }
  } catch { /* Return a generic failure without reflecting provider details or tokens. */ }
  return NextResponse.redirect(new URL("/sign-in?error=callback", applicationOrigin()));
}
