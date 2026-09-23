import { db } from "@/db";
import {
  adminEvents,
  bidEvents,
  bids,
  disputes,
  lots,
  orders,
  reports,
  users,
  type UserRow,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";

const H = 3_600_000;
const fromNow = (h: number) => new Date(Date.now() + h * H);
const ago = (h: number) => new Date(Date.now() - h * H);

async function upsertUser(input: {
  email: string;
  alias: string;
  role: string;
  displayName?: string;
}) {
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      alias: input.alias,
      role: input.role,
      provider: "seed",
      displayName: input.displayName ?? input.alias,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (row) return row;
  const found = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  return found[0];
}

export async function seedOperations(): Promise<void> {
  /* ----------------------------- People ----------------------------- */
  const admin = await upsertUser({
    email: "admin@aucta.preview",
    alias: "house*0001",
    role: "admin",
    displayName: "AUCTA Desk",
  });

  const verifiedSeller = await upsertUser({
    email: "dewa.wardana@aucta.local",
    alias: "dewa*71",
    role: "seller",
    displayName: "Dewa Wardana",
  });
  await db
    .update(users)
    .set({
      sellerStatus: "verified",
      sellerVerified: true,
      sellerCity: "Jakarta Selatan",
      sellerProvince: "DKI Jakarta",
      sellerBio:
        "Watches and design objects, consigned from a single-family collection in Jakarta. Every piece photographed in the condition it ships.",
      metrics: {
        responseHours: 2.1,
        shippingHours: 27,
        successfulSales: 23,
        ratingAvg: 4.9,
        ratingsCount: 31,
      },
    })
    .where(eq(users.id, verifiedSeller.id));

  const pendingSeller = await upsertUser({
    email: "laras.putri@aucta.local",
    alias: "laras*88",
    role: "seller",
    displayName: "Laras Putri",
  });
  await db
    .update(users)
    .set({
      sellerStatus: "pending",
      sellerCity: "Bandung",
      sellerProvince: "West Java",
      sellerBio: "Vintage cameras and analog audio.",
      sellerApplication: {
        fullName: "Laras Putri",
        idKind: "KTP",
        idNumber: "3273********4412",
        city: "Bandung",
        province: "West Java",
        phone: "+62 812 **** 2087",
        statement:
          "I photograph every object myself, disclose flaws, and ship within two working days of payment.",
        submittedAt: new Date(Date.now() - 6 * H).toISOString(),
      },
    })
    .where(eq(users.id, pendingSeller.id));

  /* ------------- Attach some live lots to the verified seller -------- */
  const ownedSlugs: Record<string, { authenticity: string; ship: number; notes: string }> = {
    "frederique-constant-highlife-full-set": {
      authenticity:
        "Original warranty card stamped by the Jakarta AD, dated 2023. Outer and inner boxes, hangtag and booklet photographed. Reference and serial numbers match the card.",
      ship: 45_000,
      notes: "Insured courier across Jawa; next-day pickup in Jakarta Selatan.",
    },
    "studio-stoneware-vase-signed": {
      authenticity:
        "Maker's chop stamped at the foot; receipt from the 2023 open-kiln sale included.",
      ship: 90_000,
      notes: "Double-boxed with foam. Allow 2–4 working days.",
    },
    "adidas-campus-00s-collab-us9": {
      authenticity:
        "Raffle confirmation email and tagged box photographed. Size label and production date shown.",
      ship: 60_000,
      notes: "Double-boxed, size US 9.",
    },
  };
  for (const [slug, data] of Object.entries(ownedSlugs)) {
    await db
      .update(lots)
      .set({
        ownerId: verifiedSeller.id,
        sellerAlias: verifiedSeller.alias,
        authenticity: data.authenticity,
        shippingCost: data.ship,
        shippingNotes: data.notes,
      })
      .where(eq(lots.slug, slug));
  }

  /* ------------------------- Seller listings ------------------------ */
  const draftBase = {
    ownerId: verifiedSeller.id,
    sellerAlias: verifiedSeller.alias,
    sellerCity: "Jakarta Selatan",
    sellerProvince: "DKI Jakarta",
    stage: "draft",
    status: "draft",
    reviewedAt: null,
    submittedAt: null,
  } as const;

  await db.insert(lots).values([
    {
      ...draftBase,
      slug: "draft-seiko-6105-willard",
      title: "Seiko 6105 “Captain Willard”, project piece",
      category: "watches",
      condition: "Fair",
      description:
        "Early 6105 with the iconic cushion case. Runs fast and will need a full service; selling as a project.",
      flaws: "Runs +40s/day. Insert faded. Crown cross-threaded on the tube.",
      image: "/images/lots/watch-2.jpg",
      images: ["/images/lots/watch-2.jpg"],
      startAmount: 2_500_000,
      currentAmount: 2_500_000,
      shippingCost: 50_000,
      startsAt: fromNow(72),
      endsAt: fromNow(72 + 120),
    },
    {
      ...draftBase,
      slug: "draft-canon-af35m",
      title: "Canon AF35M compact, untested",
      category: "cameras",
      condition: "For Parts",
      description: "Point-and-shoot classic, found in a storage unit. No battery to test.",
      flaws: "Untested. Battery compartment shows light corrosion.",
      image: "/images/lots/camera-1.jpg",
      images: ["/images/lots/camera-1.jpg"],
      startAmount: 200_000,
      currentAmount: 200_000,
      startsAt: fromNow(72),
      endsAt: fromNow(72 + 96),
    },
    {
      ...draftBase,
      stage: "under_review",
      status: "under_review",
      submittedAt: ago(5),
      slug: "review-leica-m6-classic",
      title: "Leica M6 classic 0.72, recent CLA",
      category: "cameras",
      condition: "Excellent",
      description:
        "Black chrome M6 with the classic 0.72 finder. Meter accurate, shutter speeds verified across the range after a 2025 CLA.",
      flaws: "Light bright marks on the baseplate. Body covering excellent.",
      provenance: "Single owner since 2009, purchased new in Singapore.",
      authenticity:
        "Top-plate and internal engraving numbers photographed. CLA receipt from January 2025 included.",
      image: "/images/lots/camera-3.jpg",
      images: [
        "/images/lots/camera-3.jpg",
        "/images/lots/camera-1.jpg",
        "/images/lots/camera-2.jpg",
      ],
      startAmount: 28_000_000,
      currentAmount: 28_000_000,
      reserveAmount: 34_000_000,
      shippingCost: 120_000,
      shippingNotes: "Insured, signature required.",
      startsAt: fromNow(36),
      endsAt: fromNow(36 + 144),
    },
    {
      ...draftBase,
      stage: "rejected",
      status: "rejected",
      submittedAt: ago(72),
      reviewedAt: ago(60),
      reviewedBy: admin.id,
      reviewNote:
        "Grading labels are not legible in the photos. Please reshoot the slab edges under even light and include the certificate number before resubmitting.",
      slug: "rejected-bulk-graded-cards",
      title: "Bulk graded card lot, misc conditions",
      category: "cards",
      condition: "Good",
      description: "Eight assorted graded slabs from the 2018–2020 runs.",
      flaws: "Mixed grades; two slabs have hairline cracks.",
      image: "/images/lots/card-2.jpg",
      images: ["/images/lots/card-2.jpg", "/images/lots/card-1.jpg"],
      startAmount: 1_000_000,
      currentAmount: 1_000_000,
      startsAt: ago(48),
      endsAt: ago(48 - 72),
    },
  ]);

  /* ------------------------------ Orders ---------------------------- */
  const soldLots = await db
    .select()
    .from(lots)
    .where(eq(lots.status, "sold"))
    .orderBy(asc(lots.endsAt));
  const bidders = await db.select().from(users).where(eq(users.provider, "seed")).limit(6);
  const orderStatuses = [
    "completed",
    "completed",
    "shipped",
    "payment_failed",
    "disputed",
  ] as const;

  const createdOrders = [];
  for (let i = 0; i < soldLots.length; i++) {
    const lot = soldLots[i];
    const status = orderStatuses[i % orderStatuses.length];
    const buyer = bidders[i % Math.max(1, bidders.length)];
    const hammer = Number(lot.soldAmount ?? lot.currentAmount);
    const shipping = Number(lot.shippingCost ?? 0);
    const sellerFee = Math.round((hammer * 700) / 10_000);
    const amountDue = hammer + shipping;
    const paid = status !== "payment_failed";
    const paidAt = paid ? new Date(lot.endsAt.getTime() + 6 * H) : null;
    const [order] = await db
      .insert(orders)
      .values({
        number: `AUCT-${2040 + i}-SEED`,
        lotId: lot.id,
        buyerId: buyer?.id ?? null,
        sellerId: lot.ownerId,
        buyerAlias: buyer?.alias ?? lot.leadingAlias ?? "merak*42",
        sellerAlias: lot.sellerAlias,
        winnerAlias: lot.leadingAlias ?? buyer?.alias ?? "merak*42",
        lotTitle: lot.title,
        lotImage: lot.image,
        hammerAmount: hammer,
        buyerFeeAmount: 0,
        sellerFeeAmount: sellerFee,
        shippingCost: shipping,
        amountDue,
        snapshot: {
          version: 1,
          lot: { slug: lot.slug, title: lot.title },
          money: {
            hammer,
            shipping,
            buyerFee: 0,
            sellerFee,
            amountDue,
            sellerPayout: hammer - sellerFee,
            currency: "IDR",
          },
        },
        status: paid ? (status as string) : status,
        shippingOption: shipping > 0 ? "standard" : "pickup",
        shippingLabel: "JNE REG",
        shippingAddress: paid
          ? {
              recipientName: buyer?.displayName ?? "Collector",
              phone: "+62 812 **** 4421",
              line1: "Jl. Sudirman 12",
              city: lot.sellerCity,
              province: lot.sellerProvince,
            }
          : null,
        carrier: paid && status !== "disputed" ? "JNE" : null,
        carrierStatus:
          status === "shipped"
            ? "in_transit"
            : status === "completed"
              ? "delivered"
              : "pending",
        trackingNumber: paid ? `JNE${200000 + i}` : null,
        paymentProvider: paid ? "manual" : null,
        paymentMethod: paid ? "bank_transfer" : null,
        paymentRef: paid ? `manual-ORD-${2040 + i}` : null,
        paidAmount: paid ? amountDue : null,
        paymentExpiresAt: new Date(lot.endsAt.getTime() + 24 * H),
        paymentDueAt: new Date(lot.endsAt.getTime() + 24 * H),
        paidAt,
        preparingAt: paidAt,
        dispatchDueAt: new Date(lot.endsAt.getTime() + 72 * H),
        shippedAt:
          status === "shipped" || status === "completed"
            ? new Date(lot.endsAt.getTime() + 30 * H)
            : null,
        deliveredAt: status === "completed" ? new Date(lot.endsAt.getTime() + 60 * H) : null,
        completedAt: status === "completed" ? new Date(lot.endsAt.getTime() + 80 * H) : null,
        cancelledAt: status === "payment_failed" ? new Date(lot.endsAt.getTime() + 30 * H) : null,
        statusReason: status === "payment_failed" ? "payment_expired" : null,
      })
      .returning();
    if (order) createdOrders.push(order);
  }

  const disputedOrder = createdOrders.find((o) => o.status === "disputed");
  const failedOrder = createdOrders.find((o) => o.status === "payment_failed");
  const failedLot = soldLots.find((l) => l.id === failedOrder?.lotId);
  const disputedLot = soldLots.find((l) => l.id === disputedOrder?.lotId);

  /* ----------------------------- Disputes --------------------------- */
  if (disputedOrder) {
    await db.insert(disputes).values({
      orderId: disputedOrder.id,
      lotId: disputedOrder.lotId,
      openedById: disputedOrder.buyerId ?? null,
      openedByAlias: disputedOrder.winnerAlias,
      reason: "item_not_received",
      evidence:
        "Tracking number has not updated in 9 days. Courier confirms the parcel was never handed to them. Chat screenshots attached.",
      status: "open",
    });
  }
  const resolvedOrder = createdOrders.find((o) => o.status === "completed");
  if (resolvedOrder) {
    await db.insert(disputes).values({
      orderId: resolvedOrder.id,
      lotId: resolvedOrder.lotId,
      openedById: resolvedOrder.buyerId ?? null,
      openedByAlias: resolvedOrder.winnerAlias,
      reason: "not_as_described",
      evidence: "Crystal scratch not visible in listing photos.",
      status: "resolved",
      resolution:
        "Part-refund of Rp 250.000 agreed with the seller; buyer kept the item. Order resumed and completed.",
      resolvedBy: admin.id,
      resolvedAt: ago(24 * 18),
      createdAt: ago(24 * 22),
    });
  }

  /* ----------------------------- Reports ---------------------------- */
  const holoLot = await db
    .select()
    .from(lots)
    .where(eq(lots.slug, "holo-elemental-bird-first-edition-psa9"))
    .limit(1);
  if (holoLot[0]) {
    await db.insert(reports).values([
      {
        targetType: "lot",
        lotId: holoLot[0].id,
        reporterId: bidders[0]?.id ?? null,
        reason: "suspected_counterfeit",
        message:
          "The holo pattern in photo 1 does not match reference examples of this first-edition print. Could the desk verify the slab number?",
        status: "open",
        createdAt: ago(3),
      },
      {
        targetType: "seller",
        sellerId: verifiedSeller.id,
        reporterId: bidders[1]?.id ?? null,
        reason: "misleading_photos",
        message: "Condition photos look heavily overexposed, hiding dial marks.",
        status: "open",
        createdAt: ago(26),
      },
      {
        targetType: "lot",
        lotId: soldLots[0]?.id ?? null,
        reporterId: bidders[2]?.id ?? null,
        reason: "prohibited_category",
        message: "Question about whether the bundled accessory is permitted.",
        status: "resolved",
        resolution: "Reviewed; the accessory is permitted. Reporter informed.",
        resolvedBy: admin.id,
        resolvedAt: ago(48),
        createdAt: ago(70),
      },
    ]);
    await db
      .update(lots)
      .set({ reportCount: 1 })
      .where(eq(lots.id, holoLot[0].id));
  }

  /* ------------ Late-bid events for the bidding-safety queue -------- */
  if (holoLot[0]) {
    const end = new Date(holoLot[0].endsAt).getTime();
    const lateBidder = bidders[3] ?? bidders[0];
    if (lateBidder) {
      await db.insert(bidEvents).values([
        {
          lotId: holoLot[0].id,
          lotSlug: holoLot[0].slug,
          userId: lateBidder.id,
          alias: lateBidder.alias,
          type: "bid_placed",
          amount: 3_200_000,
          createdAt: new Date(end - 95_000),
        },
        {
          lotId: holoLot[0].id,
          lotSlug: holoLot[0].slug,
          userId: lateBidder.id,
          alias: lateBidder.alias,
          type: "proxy_extended",
          amount: 3_200_000,
          meta: { seconds: 120 },
          createdAt: new Date(end - 40_000),
        },
      ]);
    }
  }

  /* --------------------------- Audit trail -------------------------- */
  await db.insert(adminEvents).values([
    {
      adminId: admin.id,
      adminAlias: admin.alias,
      action: "seller_verified",
      targetType: "seller",
      targetId: verifiedSeller.id,
      reason: "Identity documents matched; first consignment history clean.",
      createdAt: ago(24 * 40),
    },
    {
      adminId: admin.id,
      adminAlias: admin.alias,
      action: "listing_rejected",
      targetType: "lot",
      reason: "Illegible grading labels; reshoot requested.",
      createdAt: ago(60),
    },
    {
      adminId: admin.id,
      adminAlias: admin.alias,
      action: "dispute_resolved",
      targetType: "dispute",
      reason: "Part-refund agreed and recorded.",
      createdAt: ago(24 * 18),
    },
  ]);

  void disputedLot;
  void failedLot;
  void bids;
}
