import { NextResponse } from "next/server";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.isDefault) {
    await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
  }
  await db
    .update(addresses)
    .set({
      ...(body.label ? { label: String(body.label) } : {}),
      ...(body.recipientName ? { recipientName: String(body.recipientName) } : {}),
      ...(body.phone ? { phone: String(body.phone) } : {}),
      ...(body.line1 ? { line1: String(body.line1) } : {}),
      ...(body.line2 ? { line2: String(body.line2) } : {}),
      ...(body.city ? { city: String(body.city) } : {}),
      ...(body.province ? { province: String(body.province) } : {}),
      ...(body.postalCode ? { postalCode: String(body.postalCode) } : {}),
      ...(body.isDefault ? { isDefault: true } : {}),
    })
    .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  await db
    .delete(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  return NextResponse.json({ ok: true });
}
