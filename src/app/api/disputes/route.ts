import { NextResponse } from "next/server";
import { db } from "@/db";
import { disputes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.lotId !== "string")
    return NextResponse.json({ error: "Missing lot." }, { status: 400 });
  if (!String(body?.reason ?? "").trim())
    return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  await db.insert(disputes).values({
    orderId: typeof body?.orderId === "string" ? body.orderId : null,
    lotId: body.lotId,
    openedById: user.id,
    openedByAlias: user.alias,
    reason: String(body.reason),
    evidence: String(body?.evidence ?? "").slice(0, 4000),
  });

  return NextResponse.json({ ok: true });
}
