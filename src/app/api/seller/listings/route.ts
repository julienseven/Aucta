import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createDraft } from "@/lib/seller";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.suspended)
    return NextResponse.json({ error: "Account suspended." }, { status: 403 });

  const draft = await createDraft(user.id);
  return NextResponse.json({ ok: true, id: draft.id, slug: draft.slug });
}
