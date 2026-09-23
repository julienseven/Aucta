import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { lots, orders, users, type LotRow, type UserRow } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export const LISTING_STAGES = [
  "draft",
  "under_review",
  "rejected",
  "published",
  "paused",
  "withdrawn",
] as const;
export type ListingStage = (typeof LISTING_STAGES)[number];

export type SellerStats = {
  drafts: number;
  inReview: number;
  active: number;
  sold: number;
  rejected: number;
  hammerVolume: number;
  successfulSales: number;
  responseHours: number | null;
  shippingHours: number | null;
  ratingAvg: number | null;
};

export function hashImages(images: string[]): string[] {
  return images.map(
    (src, i) =>
      `sha256:${createHash("sha256")
        .update(`${i}|${src.trim()}`)
        .digest("hex")
        .slice(0, 18)}`,
  );
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "listing"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function getSellerListings(userId: string): Promise<LotRow[]> {
  return db
    .select()
    .from(lots)
    .where(eq(lots.ownerId, userId))
    .orderBy(desc(lots.createdAt));
}

export async function getSellerStats(
  userId: string,
  seller?: UserRow | null,
): Promise<SellerStats> {
  const rows = await getSellerListings(userId);
  const sum = (stage: string) =>
    rows.filter((r) => r.stage === stage).length;
  const soldRows = rows.filter((r) => r.status === "sold");
  const hammerVolume = soldRows.reduce(
    (acc, r) => acc + Number(r.soldAmount ?? r.currentAmount),
    0,
  );
  const metrics = seller?.metrics ?? {};
  return {
    drafts: sum("draft"),
    inReview: sum("under_review"),
    active: rows.filter((r) => ["live", "upcoming"].includes(r.status) && r.stage === "published").length,
    sold: soldRows.length,
    rejected: sum("rejected"),
    hammerVolume,
    successfulSales: metrics.successfulSales ?? soldRows.length,
    responseHours: metrics.responseHours ?? null,
    shippingHours: metrics.shippingHours ?? null,
    ratingAvg: metrics.ratingAvg ?? null,
  };
}

export async function getSellerTransactionHistory(userId: string) {
  return db
    .select({
      number: orders.number,
      status: orders.status,
      hammer: orders.hammerAmount,
      createdAt: orders.createdAt,
      title: lots.title,
      slug: lots.slug,
      image: lots.image,
    })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .where(eq(lots.ownerId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getPublicSeller(alias: string) {
  const rows = await db.select().from(users).where(eq(users.alias, alias)).limit(1);
  return rows[0] ?? null;
}

export async function getPublicSellerLots(userId: string) {
  return db
    .select()
    .from(lots)
    .where(and(eq(lots.ownerId, userId), eq(lots.stage, "published")))
    .orderBy(desc(lots.createdAt));
}

export type ListingDraft = {
  title: string;
  category: string;
  condition: string;
  description: string;
  flaws: string;
  provenance: string;
  authenticity: string;
  shippingNotes: string;
  images: string[];
  startAmount: number | null;
  reserveAmount: number | null;
  shippingCost: number | null;
  startsInHours: number | null;
  durationHours: number | null;
};

export async function createDraft(userId: string): Promise<LotRow> {
  const now = new Date();
  const [row] = await db
    .insert(lots)
    .values({
      slug: slugify("draft"),
      title: "Untitled listing",
      category: "watches",
      condition: "Good",
      status: "draft",
      stage: "draft",
      description: "",
      image: "/images/lots/watch-1.jpg",
      images: ["/images/lots/watch-1.jpg"],
      ownerId: userId,
      sellerAlias: (await db.select({ alias: users.alias }).from(users).where(eq(users.id, userId)).limit(1))[0]?.alias ?? "house",
      startAmount: 0,
      currentAmount: 0,
      startsAt: new Date(now.getTime() + 72 * 3_600_000),
      endsAt: new Date(now.getTime() + (72 + 120) * 3_600_000),
    })
    .returning();
  return row;
}

export async function getOwnedListing(
  userId: string,
  id: string,
): Promise<LotRow | null> {
  const rows = await db
    .select()
    .from(lots)
    .where(and(eq(lots.id, id), eq(lots.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveDraft(
  userId: string,
  id: string,
  data: ListingDraft,
): Promise<LotRow> {
  const existing = await getOwnedListing(userId, id);
  if (!existing) throw new Error("Listing not found");
  if (!["draft", "rejected"].includes(existing.stage))
    throw new Error("Only drafts can be edited");

  const images = data.images.length ? data.images : [existing.image];
  const start = data.startAmount ?? 0;
  const startsIn = data.startsInHours ?? 48;
  const duration = data.durationHours ?? 120;
  const [row] = await db
    .update(lots)
    .set({
      title: data.title?.trim() || "Untitled listing",
      category: data.category,
      condition: data.condition,
      description: data.description,
      flaws: data.flaws,
      provenance: data.provenance,
      authenticity: data.authenticity,
      shippingNotes: data.shippingNotes,
      image: images[0],
      images,
      startAmount: start,
      currentAmount: start,
      reserveAmount: data.reserveAmount ?? null,
      shippingCost: data.shippingCost ?? 0,
      slug:
        existing.title === "Untitled listing" || existing.slug.startsWith("draft-")
          ? slugify(data.title || "listing")
          : existing.slug,
      startsAt: new Date(Date.now() + startsIn * 3_600_000),
      endsAt: new Date(Date.now() + (startsIn + duration) * 3_600_000),
      reviewNote: existing.stage === "rejected" ? null : existing.reviewNote,
      stage: "draft",
      status: "draft",
    })
    .where(eq(lots.id, id))
    .returning();
  return row;
}

export async function submitListing(
  userId: string,
  id: string,
  data: ListingDraft,
): Promise<LotRow> {
  const sellerRows = await db
    .select({ sellerStatus: users.sellerStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (sellerRows[0]?.sellerStatus !== "verified")
    throw new Error("VERIFICATION_REQUIRED");
  if (!data.title.trim() || data.title.trim().length < 6)
    throw new Error("TITLE_REQUIRED");
  if (!data.description.trim() || data.description.trim().length < 40)
    throw new Error("DESCRIPTION_REQUIRED");
  if (!data.images.length) throw new Error("PHOTOS_REQUIRED");
  if (!data.startAmount || data.startAmount < 10_000)
    throw new Error("PRICE_REQUIRED");

  const saved = await saveDraft(userId, id, data);
  const [row] = await db
    .update(lots)
    .set({
      stage: "under_review",
      status: "under_review",
      submittedAt: new Date(),
      imageHashes: hashImages(saved.images),
      reviewNote: null,
    })
    .where(eq(lots.id, id))
    .returning();
  return row;
}

export async function deleteDraft(userId: string, id: string): Promise<void> {
  await db
    .delete(lots)
    .where(and(eq(lots.id, id), eq(lots.ownerId, userId), eq(lots.stage, "draft")));
}

export async function applyAsSeller(
  user: UserRow,
  application: Record<string, unknown>,
): Promise<void> {
  await db
    .update(users)
    .set({
      role: sql`CASE WHEN ${users.role} = 'admin' THEN 'admin' ELSE 'seller' END`,
      sellerStatus: "pending",
      sellerApplication: application,
      sellerCity: String(application.city ?? user.sellerCity ?? ""),
      sellerProvince: String(application.province ?? user.sellerProvince ?? ""),
      displayName: user.displayName ?? String(application.fullName ?? user.alias),
    })
    .where(eq(users.id, user.id));
}
