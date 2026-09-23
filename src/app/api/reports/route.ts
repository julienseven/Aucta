import { NextResponse } from "next/server";
import { db } from "@/db";
import { lots, reports } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in to report." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetType = body?.targetType === "seller" ? "seller" : "lot";
  const reason = String(body?.reason ?? "other");
  const message = String(body?.message ?? "").slice(0, 2000);

  if (targetType === "lot" && typeof body?.lotId !== "string")
    return NextResponse.json({ error: "Missing target." }, { status: 400 });
  if (targetType === "seller" && typeof body?.sellerId !== "string")
    return NextResponse.json({ error: "Missing target." }, { status: 400 });

  await db.insert(reports).values({
    reporterId: user.id,
    targetType,
    lotId: targetType === "lot" ? body.lotId : null,
    sellerId: targetType === "seller" ? body.sellerId : null,
    reason,
    message,
  });

  if (targetType === "lot") {
    await db
      .update(lots)
      .set({ reportCount: sql`${lots.reportCount} + 1` })
      .where(eq(lots.id, body.lotId));
  }

  return NextResponse.json({ ok: true });
}
