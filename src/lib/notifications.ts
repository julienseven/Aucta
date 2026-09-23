import "server-only";
import { db } from "@/db";
import { emailOutbox, notifications } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { formatRupiah } from "@/lib/format";
import type { LotRow, UserRow } from "@/db/schema";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";

export type NotificationType =
  | "auction_starting"
  | "ending_soon"
  | "outbid"
  | "reserve_met"
  | "won"
  | "unsold"
  | "payment_required"
  | "payment_confirmed"
  | "ship_reminder"
  | "shipped"
  | "delivered"
  | "dispute_update"
  | "saved_match"
  | "seller_new_bid"
  | "listing_approved"
  | "listing_rejected";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  lotId?: string | null;
  dedupeKey?: string | null;
  email?: boolean;
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const rows = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        link: input.link ?? null,
        lotId: input.lotId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id, userId: notifications.userId });

    if (rows.length === 0) return; // deduped

    if (input.email !== false) {
      const userRows = await db
        .select({ email: users_email.email })
        .from(users_email)
        .where(eq(users_email.id, input.userId))
        .limit(1);
      const to = userRows[0]?.email;
      if (to) {
        const { queued, sent } = await sendEmail({
          to,
          subject: input.title,
          text: `${input.body ?? ""}${input.link ? `\n\n${baseUrl()}${input.link}` : ""}\n\n— AUCTA`,
        });
        await db
          .update(notifications)
          .set({ emailedAt: new Date() })
          .where(eq(notifications.id, rows[0].id));
        logger.info("notification_email", {
          type: input.type,
          queued,
          sent,
        });
      }
    }
  } catch (err) {
    logger.error("notification_failed", { type: input.type, error: String(err) });
  }
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "";
}

/* Local alias to keep the email lookup readable. */
import { users as users_email } from "@/db/schema";

export async function notifyMany(
  userIds: string[],
  build: (userId: string) => Omit<NotifyInput, "userId">,
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  await Promise.all(unique.map((id) => notify({ userId: id, ...build(id) })));
}

/* ------------------------- Lot template helpers ------------------------- */

export function lotLink(lot: Pick<LotRow, "slug">): string {
  return `/auctions/${lot.slug}`;
}

export async function notifyOutbid(
  lot: LotRow,
  outbidUserIds: string[],
  newLeaderAlias: string,
): Promise<void> {
  await notifyMany(outbidUserIds, () => ({
    type: "outbid",
    title: `You were outbid on "${lot.title}"`,
    body: `Another bidder (${newLeaderAlias}) now leads. The current bid is ${formatRupiah(
      Number(lot.currentAmount),
    )}. Increase your maximum before the bell.`,
    link: lotLink(lot),
    lotId: lot.id,
    dedupeKey: null,
  }));
}

export async function notifyReserveMet(lot: LotRow, watcherIds: string[]): Promise<void> {
  await notifyMany(watcherIds, () => ({
    type: "reserve_met",
    title: `Reserve met on "${lot.title}"`,
    body: `Bidding has reached the reserve at ${formatRupiah(
      Number(lot.currentAmount),
    )}. The lot will sell if it leads at the close.`,
    link: lotLink(lot),
    lotId: lot.id,
    dedupeKey: `reserve:${lot.id}`,
    email: false,
  }));
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.length;
}

export async function listNotifications(userId: string, limit = 40) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/* Returns distinct users watching a lot. */
export { inArray, lt };
export type { UserRow };
