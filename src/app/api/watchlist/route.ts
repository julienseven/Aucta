import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lots, watchlist } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ ids: [] });
  const rows = await db
    .select({ lotId: watchlist.lotId })
    .from(watchlist)
    .where(eq(watchlist.userId, user.id));
  return NextResponse.json({ ids: rows.map((r) => r.lotId) });
}

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in to follow lots." }, { status: 401 });

  const { lotId } = await req.json().catch(() => ({}));
  if (typeof lotId !== "string")
    return NextResponse.json({ error: "Missing lotId." }, { status: 400 });

  const inserted = await db
    .insert(watchlist)
    .values({ userId: user.id, lotId })
    .onConflictDoNothing()
    .returning();

  // Correct watcher counting: only count genuinely new follows.
  if (inserted.length > 0) {
    await db
      .update(lots)
      .set({ watchCount: sql`${lots.watchCount} + 1` })
      .where(eq(lots.id, lotId));
  }

  return NextResponse.json({ ok: true, watching: true, added: inserted.length > 0 });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in to manage your watchlist." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lotId = String(body?.lotId ?? "");
  if (!lotId)
    return NextResponse.json({ error: "Missing lotId." }, { status: 400 });

  const deleted = await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.lotId, lotId)))
    .returning();
  if (deleted.length > 0) {
    await db
      .update(lots)
      .set({ watchCount: sql`GREATEST(${lots.watchCount} - 1, 0)` })
      .where(eq(lots.id, lotId));
  }
  return NextResponse.json({ ok: true, watching: false });
}
