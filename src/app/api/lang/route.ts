import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "@/lib/i18n/server";
import { LANGS, type Lang } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lang = String(body?.lang ?? "");
  if (!LANGS.includes(lang as Lang)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, lang });
}
