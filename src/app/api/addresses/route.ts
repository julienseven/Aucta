import { NextResponse } from "next/server";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

function validate(body: Record<string, unknown>) {
  const required = ["recipientName", "phone", "line1", "city", "province"] as const;
  for (const k of required) {
    if (!String(body[k] ?? "").trim()) return k;
  }
  return null;
}

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ items: [] });
  const items = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const rl = rateLimit(`address:${user.id}:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const missing = validate(body);
  if (missing)
    return NextResponse.json({ error: `Missing ${missing}` }, { status: 400 });

  const isFirst =
    (
      await db
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, user.id))
        .limit(1)
    ).length === 0;

  if (body.isDefault || isFirst) {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, user.id));
  }

  const [row] = await db
    .insert(addresses)
    .values({
      userId: user.id,
      label: String(body.label ?? "Home"),
      recipientName: String(body.recipientName).trim(),
      phone: String(body.phone).trim(),
      line1: String(body.line1).trim(),
      line2: String(body.line2 ?? "").trim(),
      city: String(body.city).trim(),
      province: String(body.province).trim(),
      postalCode: String(body.postalCode ?? "").trim(),
      isDefault: Boolean(body.isDefault) || isFirst,
    })
    .returning();
  return NextResponse.json({ ok: true, id: row.id });
}
