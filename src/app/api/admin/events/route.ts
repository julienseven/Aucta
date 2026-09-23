import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdmin, getLotEvents } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!isAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const lotId = new URL(req.url).searchParams.get("lotId");
  if (!lotId) return NextResponse.json({ events: [] });
  const events = await getLotEvents(lotId);
  return NextResponse.json({ events });
}
