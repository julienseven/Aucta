import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteDraft,
  saveDraft,
  submitListing,
  type ListingDraft,
} from "@/lib/seller";

export const dynamic = "force-dynamic";

function toDraft(body: Record<string, unknown>): ListingDraft {
  const num = (v: unknown) => {
    const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    title: String(body?.title ?? ""),
    category: String(body?.category ?? "watches"),
    condition: String(body?.condition ?? "Good"),
    description: String(body?.description ?? ""),
    flaws: String(body?.flaws ?? ""),
    provenance: String(body?.provenance ?? ""),
    authenticity: String(body?.authenticity ?? ""),
    shippingNotes: String(body?.shippingNotes ?? ""),
    images: Array.isArray(body?.images) ? (body!.images as string[]) : [],
    startAmount: num(body?.startAmount),
    reserveAmount: body?.reserveEnabled ? num(body?.reserveAmount) : null,
    shippingCost: num(body?.shippingCost) ?? 0,
    startsInHours: num(body?.startsInHours) ?? 48,
    durationHours: num(body?.durationHours) ?? 120,
  };
}

async function guard() {
  const user = await getSessionUser().catch(() => null);
  return user;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.suspended)
    return NextResponse.json({ error: "Account suspended." }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = toDraft(body);
  const action = String(body?.action ?? "save");

  try {
    if (action === "submit") {
      const row = await submitListing(user.id, id, data);
      return NextResponse.json({ ok: true, stage: row.stage });
    }
    const row = await saveDraft(user.id, id, data);
    return NextResponse.json({ ok: true, stage: row.stage });
  } catch (err) {
    const code = err instanceof Error ? err.message : "ERROR";
    return NextResponse.json({ error: code, code }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await guard();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  await deleteDraft(user.id, id);
  return NextResponse.json({ ok: true });
}
