import { NextResponse } from "next/server";
import { lots } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (!ids.length) return NextResponse.json({ lots: [] });
  const rows = await db.select().from(lots).where(inArray(lots.id, ids));
  return NextResponse.json({
    lots: rows.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      category: l.category,
      condition: l.condition,
      status: l.status,
      image: l.image,
      currentAmount: Number(l.currentAmount),
      soldAmount: l.soldAmount != null ? Number(l.soldAmount) : null,
      endsAt: l.endsAt.toISOString(),
      startsAt: l.startsAt.toISOString(),
      bidCount: l.bidCount,
      watchCount: l.watchCount,
      sellerCity: l.sellerCity,
      sellerProvince: l.sellerProvince,
    })),
  });
}
