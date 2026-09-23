import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteSavedSearch } from "@/lib/collector";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required.", code: "AUTH" }, { status: 401 });
  const { id } = await params;
  await deleteSavedSearch(user.id, id);
  return NextResponse.json({ ok: true });
}
