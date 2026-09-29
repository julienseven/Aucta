import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { openOrderDispute } from "@/lib/disputes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.lotId !== "string")
    return NextResponse.json({ error: "Missing lot." }, { status: 400 });
  if (typeof body?.orderId !== "string" || !body.orderId.trim())
    return NextResponse.json({ error: "Missing order." }, { status: 400 });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(body.lotId) || !uuid.test(body.orderId))
    return NextResponse.json({ error: "Invalid lot or order." }, { status: 400 });
  if (!String(body?.reason ?? "").trim())
    return NextResponse.json({ error: "Choose a reason." }, { status: 400 });

  const result = await openOrderDispute({
    orderId: body.orderId,
    lotId: body.lotId,
    openedById: user.id,
    openedByAlias: user.alias,
    reason: String(body.reason).trim(),
    evidence: String(body?.evidence ?? "").slice(0, 4000),
  });
  if (!result.ok) {
    const response: { status: number; error: string } = {
      NOT_FOUND: { status: 404, error: "Order not found." },
      LOT_MISMATCH: { status: 400, error: "Order does not belong to this lot." },
      FORBIDDEN: { status: 403, error: "Only an order participant can open a dispute." },
      STATE: { status: 409, error: "This order cannot be disputed in its current state." },
      EXISTS: { status: 409, error: "A dispute already exists for this order." },
    }[result.code];
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
