import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { followSeller, unfollowSeller } from "@/lib/collector";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required.", code: "AUTH" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sellerId = String(body?.sellerId ?? "");
  if (!sellerId)
    return NextResponse.json({ error: "Missing seller." }, { status: 400 });

  if (body?.action === "unfollow") {
    await unfollowSeller(user.id, sellerId);
    return NextResponse.json({ ok: true, following: false });
  }
  const result = await followSeller(user.id, sellerId);
  return NextResponse.json(result);
}
