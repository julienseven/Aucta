import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSavedSearch, listSavedSearches } from "@/lib/collector";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ items: [] });
  const items = await listSavedSearches(user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required.", code: "AUTH" }, { status: 401 });

  const rl = rateLimit(`saved:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const row = await createSavedSearch(user.id, {
    label: String(body?.label ?? ""),
    q: body?.q ? String(body.q) : null,
    category: body?.category ? String(body.category) : null,
    condition: body?.condition ? String(body.condition) : null,
    min: num(body?.min),
    max: num(body?.max),
    alert: body?.alert !== false,
  });
  return NextResponse.json({ ok: true, id: row.id });
}
