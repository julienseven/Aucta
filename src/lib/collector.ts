import "server-only";
import { db } from "@/db";
import {
  followedSellers,
  lots,
  savedSearches,
  watchlist,
  type LotRow,
} from "@/db/schema";
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { notify } from "@/lib/notifications";
import { categoryMap } from "@/lib/config";

/* ----------------------------- Saved searches ----------------------------- */

export type SavedSearchInput = {
  label: string;
  q?: string | null;
  category?: string | null;
  condition?: string | null;
  min?: number | null;
  max?: number | null;
  alert?: boolean;
};

function labelFor(s: Omit<SavedSearchInput, "label">): string {
  if (s.category) return categoryMap[s.category as keyof typeof categoryMap]?.label ?? "Saved search";
  if (s.q) return `“${s.q}”`;
  return "All auctions";
}

export async function createSavedSearch(userId: string, input: SavedSearchInput) {
  const label = input.label?.trim() || labelFor(input);
  const [row] = await db
    .insert(savedSearches)
    .values({
      userId,
      label,
      q: input.q || null,
      category: input.category || null,
      condition: input.condition || null,
      min: input.min ?? null,
      max: input.max ?? null,
      alert: input.alert ?? true,
    })
    .returning();
  return row;
}

export function listSavedSearches(userId: string) {
  return db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt));
}

export async function deleteSavedSearch(userId: string, id: string) {
  await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
}

/* ----------------------------- Followed sellers ---------------------------- */

export async function followSeller(userId: string, sellerId: string) {
  if (userId === sellerId) return { ok: false, self: true };
  await db
    .insert(followedSellers)
    .values({ userId, sellerId })
    .onConflictDoNothing();
  return { ok: true, following: true };
}

export async function unfollowSeller(userId: string, sellerId: string) {
  await db
    .delete(followedSellers)
    .where(
      and(
        eq(followedSellers.userId, userId),
        eq(followedSellers.sellerId, sellerId),
      ),
    );
  return { ok: true, following: false };
}

export function isFollowing(userId: string, sellerId: string) {
  return db
    .select({ id: followedSellers.sellerId })
    .from(followedSellers)
    .where(
      and(
        eq(followedSellers.userId, userId),
        eq(followedSellers.sellerId, sellerId),
      ),
    )
    .limit(1);
}

/* ----------------------- Match a new/approved listing ---------------------- */

function matchesSearch(lot: LotRow, s: {
  q?: string | null;
  category?: string | null;
  condition?: string | null;
  min?: number | null;
  max?: number | null;
}): boolean {
  if (s.category && s.category !== lot.category) return false;
  if (s.condition && s.condition !== lot.condition) return false;
  if (s.min != null && Number(lot.startAmount) < s.min) return false;
  if (s.max != null && Number(lot.startAmount) > s.max) return false;
  if (s.q) {
    const q = s.q.toLowerCase();
    const hay = `${lot.title} ${lot.description}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/* Notify alert owners when a lot becomes visible (approval/activation). */
export async function matchLotToAlerts(lot: LotRow): Promise<number> {
  let n = 0;

  const searches = await db.select().from(savedSearches).where(eq(savedSearches.alert, true));
  for (const s of searches) {
    if (!matchesSearch(lot, s)) continue;
    await notify({
      userId: s.userId,
      type: "saved_match",
      title: `New match: ${lot.title}`,
      body: `A new lot matches your alert “${s.label}”.`,
      link: `/auctions/${lot.slug}`,
      lotId: lot.id,
      dedupeKey: `search:${s.id}:${lot.id}`,
      email: false,
    });
    n++;
  }

  if (lot.ownerId) {
    const followers = await db
      .select({ userId: followedSellers.userId })
      .from(followedSellers)
      .where(eq(followedSellers.sellerId, lot.ownerId));
    for (const f of followers) {
      await notify({
        userId: f.userId,
        type: "saved_match",
        title: `${lot.sellerAlias} listed "${lot.title}"`,
        body: "A seller you follow has a new lot on the floor.",
        link: `/auctions/${lot.slug}`,
        lotId: lot.id,
        dedupeKey: `follow:${lot.ownerId}:${lot.id}`,
        email: false,
      });
      n++;
    }
  }

  if (n > 0) {
    await db
      .update(savedSearches)
      .set({ lastMatchedAt: new Date() })
      .where(eq(savedSearches.alert, true));
  }
  return n;
}

/* ---------------------------- Recommendations ----------------------------- */

export async function recommendFor(userId: string | null): Promise<LotRow[]> {
  let categories: string[] = [];
  if (userId) {
    const watched = await db
      .select({ category: lots.category })
      .from(watchlist)
      .innerJoin(lots, eq(watchlist.lotId, lots.id))
      .where(eq(watchlist.userId, userId));
    categories = [...new Set(watched.map((w) => w.category))].slice(0, 3);
  }

  const open = sql`${lots.status} IN ('live','upcoming') AND ${lots.stage} IN ('published','house')`;

  if (categories.length) {
    const rows = await db
      .select()
      .from(lots)
      .where(and(open, inArray(lots.category, categories)))
      .orderBy(desc(lots.endsAt))
      .limit(8);
    if (rows.length >= 4) return rows;
  }
  return db
    .select()
    .from(lots)
    .where(open)
    .orderBy(desc(lots.watchCount))
    .limit(8);
}

export async function lotsByIds(ids: string[]): Promise<LotRow[]> {
  if (!ids.length) return [];
  return db.select().from(lots).where(inArray(lots.id, ids));
}

/* --------------------------- Archive analytics ---------------------------- */

export type ArchiveAnalytics = {
  soldCount: number;
  totalValue: number;
  median: number;
  average: number;
  byCategory: { category: string; sold: number; value: number; median: number }[];
  weekly: { label: string; value: number; count: number }[];
};

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function getArchiveAnalytics(): Promise<ArchiveAnalytics> {
  const sold = await db
    .select()
    .from(lots)
    .where(and(eq(lots.status, "sold"), isNotNull(lots.soldAmount)));

  const values = sold.map((l) => Number(l.soldAmount ?? l.currentAmount));
  const totalValue = values.reduce((a, b) => a + b, 0);
  const average = values.length ? Math.round(totalValue / values.length) : 0;

  const catMap = new Map<string, number[]>();
  for (const l of sold) {
    const v = Number(l.soldAmount ?? l.currentAmount);
    catMap.set(l.category, [...(catMap.get(l.category) ?? []), v]);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, vals]) => ({
      category,
      sold: vals.length,
      value: vals.reduce((a, b) => a + b, 0),
      median: medianOf(vals),
    }))
    .sort((a, b) => b.value - a.value);

  const weekly: { label: string; value: number; count: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const inWeek = sold.filter(
      (l) => (l.closedAt ?? l.endsAt) >= start && (l.closedAt ?? l.endsAt) < end,
    );
    weekly.push({
      label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      value: inWeek.reduce(
        (a, l) => a + Number(l.soldAmount ?? l.currentAmount),
        0,
      ),
      count: inWeek.length,
    });
  }

  return {
    soldCount: sold.length,
    totalValue,
    median: medianOf(values),
    average,
    byCategory,
    weekly,
  };
}

export { or, ne };
