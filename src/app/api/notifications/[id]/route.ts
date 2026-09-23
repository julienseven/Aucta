import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  return NextResponse.json({ ok: true });
}
