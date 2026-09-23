import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getUnreadCount,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ unread: 0, items: [] });
  const [unread, items] = await Promise.all([
    getUnreadCount(user.id),
    listNotifications(user.id, 20),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.readAt != null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function POST() {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  await markNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
