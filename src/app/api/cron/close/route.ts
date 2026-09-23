import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { activateDueStarts, processDueCloses } from "@/lib/close";
import { expireUnpaidOrders } from "@/lib/payments/confirm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await activateDueStarts();
    const closed = await processDueCloses();
    const expired = await expireUnpaidOrders();
    return NextResponse.json({ ok: true, closed, expired });
  } catch {
    return NextResponse.json({ error: "Closing failed" }, { status: 503 });
  }
}
export const POST = GET;
