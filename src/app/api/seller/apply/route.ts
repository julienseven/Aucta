import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { applyAsSeller } from "@/lib/seller";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!String(body?.fullName ?? "").trim() || !String(body?.idKind ?? "").trim())
    return NextResponse.json(
      { error: "Name and identity document are required." },
      { status: 400 },
    );

  await applyAsSeller(user, {
    ...body,
    submittedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, status: "pending" });
}
