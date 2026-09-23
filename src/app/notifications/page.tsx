import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { IconBell } from "@/components/icons";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const typeIcon: Record<string, string> = {
  outbid: "⚡",
  won: "🏆",
  ending_soon: "⏳",
  reserve_met: "🎯",
  auction_starting: "🔨",
  payment_required: "💳",
  payment_confirmed: "✅",
  ship_reminder: "📦",
  shipped: "🚚",
  delivered: "📬",
  unsold: "↩️",
  dispute_update: "⚖️",
  saved_match: "🔔",
  seller_new_bid: "💬",
  listing_approved: "✔️",
  listing_rejected: "✏️",
};

export default async function NotificationsPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return (
      <div className="page-enter mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-soft text-bronze-deep">
          <IconBell size={28} />
        </span>
        <h1 className="mt-6 font-serif text-3xl">Notifications</h1>
        <p className="mt-3 text-sm text-muted-ink">
          Sign in to see bidding updates, closing reminders and order messages.
        </p>
        <Link href="/sign-in?next=/notifications" className="btn btn-primary btn-lg mt-7">
          Sign in
        </Link>
      </div>
    );
  }

  const items = await listNotifications(user.id, 100);
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <div className="page-enter mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3rem)]">
            Notifications
          </h1>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn btn-outline">Mark all read ({unread})</button>
          </form>
        )}
      </header>

      {items.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 p-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-soft text-bronze-deep">
            <IconBell size={22} />
          </span>
          <p className="text-sm text-muted-ink">
            Watch a lot or place a bid and updates will land here.
          </p>
        </div>
      ) : (
        <ul className="surface overflow-hidden">
          {items.map((n) => (
            <li
              key={n.id}
              className={`border-b border-line-soft last:border-0 ${
                n.readAt ? "" : "bg-cream/60"
              }`}
            >
              <Link
                href={n.link ?? "/account"}
                className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-cream"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-base">
                  {typeIcon[n.type] ?? "🔔"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {!n.readAt && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-bronze" />
                    )}
                    <span className="truncate text-sm font-semibold">{n.title}</span>
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-ink">
                      {n.body}
                    </span>
                  )}
                  <span className="mt-1 block text-[0.66rem] text-faint">
                    {formatDateTime(n.createdAt.toISOString())}
                    {n.emailedAt ? " · emailed" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function markAllRead() {
  "use server";
  const user = await getSessionUser().catch(() => null);
  if (user) await markNotificationsRead(user.id);
}
