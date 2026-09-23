import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          alias: user.alias,
          role: user.role,
          provider: user.provider,
          sellerStatus: user.sellerStatus,
        }
      : null,
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
