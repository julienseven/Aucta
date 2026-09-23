import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* Users ------------------------------------------------------- */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    alias: text("alias").notNull(),
    displayName: text("display_name"),
    provider: text("provider").notNull().default("email"),
    role: text("role").notNull().default("collector"), // collector | seller | admin
    sellerStatus: text("seller_status").notNull().default("none"), // none | pending | verified | rejected
    sellerApplication: jsonb("seller_application"),
    sellerCity: text("seller_city"),
    sellerProvince: text("seller_province"),
    sellerBio: text("seller_bio"),
    metrics: jsonb("metrics")
      .$type<{
        responseHours?: number;
        shippingHours?: number;
        successfulSales?: number;
        ratingAvg?: number;
        ratingsCount?: number;
      }>()
      .default({}),
    suspended: boolean("suspended").notNull().default(false),
    suspendedReason: text("suspended_reason"),
    sellerVerified: boolean("seller_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_alias_idx").on(t.alias),
  ],
);

/* Lots / auctions --------------------------------------------- */
export const lots = pgTable(
  "lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    condition: text("condition").notNull(),
    status: text("status").notNull().default("upcoming"),
    // draft | under_review | approved | rejected | paused | withdrawn | published | house
    stage: text("stage").notNull().default("house"),
    description: text("description").notNull(),
    flaws: text("flaws").notNull().default(""),
    provenance: text("provenance").notNull().default(""),
    authenticity: text("authenticity").notNull().default(""),
    shippingNotes: text("shipping_notes").notNull().default(""),
    ownerId: uuid("owner_id"),
    sellerAlias: text("seller_alias").notNull().default("house"),
    sellerCity: text("seller_city").notNull().default("Jakarta"),
    sellerProvince: text("seller_province").notNull().default("DKI Jakarta"),
    image: text("image").notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    imageHashes: jsonb("image_hashes").$type<string[]>().notNull().default([]),
    startAmount: bigint("start_amount", { mode: "number" }).notNull(),
    reserveAmount: bigint("reserve_amount", { mode: "number" }),
    currentAmount: bigint("current_amount", { mode: "number" }).notNull(),
    shippingCost: bigint("shipping_cost", { mode: "number" }).notNull().default(0),
    soldAmount: bigint("sold_amount", { mode: "number" }),
    leadingAlias: text("leading_alias"),
    bidCount: integer("bid_count").notNull().default(0),
    watchCount: integer("watch_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    incrementOverride: bigint("increment_override", { mode: "number" }),
    reviewNote: text("review_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("lots_slug_idx").on(t.slug),
    index("lots_status_idx").on(t.status),
    index("lots_category_idx").on(t.category),
    index("lots_owner_idx").on(t.ownerId),
    index("lots_stage_idx").on(t.stage),
  ],
);

/* Proxy bids: max is private; visible price is derived. -------- */
export const bids = pgTable(
  "bids",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    maxAmount: bigint("max_amount", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bids_lot_idx").on(t.lotId),
    index("bids_user_idx").on(t.userId),
  ],
);

/* Immutable lifecycle events for auction audit ---------------- */
export const bidEvents = pgTable(
  "bid_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    lotId: uuid("lot_id").notNull(),
    lotSlug: text("lot_slug"),
    bidId: bigint("bid_id", { mode: "number" }),
    userId: uuid("user_id"),
    alias: text("alias"),
    type: text("type").notNull(), // bid_placed | proxy_extended | outbid | stage_change
    amount: bigint("amount", { mode: "number" }),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bid_events_lot_idx").on(t.lotId),
    index("bid_events_type_idx").on(t.type),
  ],
);

/* Watchlist ---------------------------------------------------- */
export const watchlist = pgTable(
  "watchlist",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lotId] })],
);

/* Buyer addresses ---------------------------------------------- */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Home"),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2").notNull().default(""),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

/* Immutable orders (opened at the hammer) ---------------------- */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),

    // Parties, snapshotted so later profile edits can't rewrite history.
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id").references(() => users.id),
    sellerId: uuid("seller_id").references(() => users.id),
    buyerAlias: text("buyer_alias").notNull().default(""),
    sellerAlias: text("seller_alias").notNull().default(""),
    winnerAlias: text("winner_alias").notNull(),

    // Lot snapshot for the immutable receipt.
    lotTitle: text("lot_title").notNull().default(""),
    lotImage: text("lot_image").notNull().default(""),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().default({}),

    // Money, snapshotted. All values whole IDR.
    hammerAmount: bigint("hammer_amount", { mode: "number" }).notNull(),
    buyerFeeAmount: bigint("buyer_fee_amount", { mode: "number" }).notNull().default(0),
    sellerFeeAmount: bigint("seller_fee_amount", { mode: "number" }).notNull().default(0),
    shippingCost: bigint("shipping_cost", { mode: "number" }).notNull().default(0),
    amountDue: bigint("amount_due", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("IDR"),

    // Lifecycle:
    // awaiting_payment → paid → preparing → shipped → delivered → completed
    // branches: cancelled | disputed | refunded | payment_failed
    status: text("status").notNull().default("awaiting_payment"),
    statusReason: text("status_reason"),

    // Checkout / shipping.
    shippingOption: text("shipping_option").notNull().default("standard"),
    shippingLabel: text("shipping_label"),
    shippingAddress: jsonb("shipping_address").$type<Record<string, unknown>>(),
    carrier: text("carrier"),
    carrierStatus: text("carrier_status").notNull().default("pending"),
    trackingNumber: text("tracking_number"),
    shipmentProof: text("shipment_proof"),
    dispatchedBy: uuid("dispatched_by"),

    // Payment.
    paymentProvider: text("payment_provider"),
    paymentMethod: text("payment_method"),
    paymentRef: text("payment_ref"),
    paidAmount: bigint("paid_amount", { mode: "number" }),
    paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),

    // Refund.
    refundAmount: bigint("refund_amount", { mode: "number" }),
    refundRef: text("refund_ref"),
    refundReason: text("refund_reason"),

    paymentDueAt: timestamp("payment_due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    preparingAt: timestamp("preparing_at", { withTimezone: true }),
    dispatchDueAt: timestamp("dispatch_due_at", { withTimezone: true }),
    shipReminderAt: timestamp("ship_reminder_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    index("orders_status_idx").on(t.status),
    index("orders_buyer_idx").on(t.buyerId),
    index("orders_seller_idx").on(t.sellerId),
  ],
);

/* Gateway payment attempts (one or more per order) ------------- */
export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // midtrans | manual
    providerRef: text("provider_ref"),
    method: text("method").notNull().default("bank_transfer"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("IDR"),
    // pending | paid | failed | expired | cancelled | refunded
    status: text("status").notNull().default("pending"),
    redirectUrl: text("redirect_url"),
    instructions: jsonb("instructions").$type<Record<string, unknown>>().default({}),
    raw: jsonb("raw").$type<Record<string, unknown>>().default({}),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    idempotencyKey: text("idempotency_key"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payment_attempts_order_idx").on(t.orderId),
    index("payment_attempts_ref_idx").on(t.providerRef),
    uniqueIndex("payment_attempts_idem_idx").on(t.idempotencyKey),
  ],
);

/* One-time auth credentials: magic links + numeric OTP --------- */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: text("purpose").notNull().default("magic_link"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("auth_tokens_email_idx").on(t.email),
    index("auth_tokens_token_idx").on(t.tokenHash),
  ],
);

/* In-app + email notifications --------------------------------- */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    lotId: uuid("lot_id"),
    data: jsonb("data").$type<Record<string, unknown>>().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupeKey),
  ],
);

/* Outbox for transactional email (and preview dev inbox) ------- */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    html: text("html"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("email_outbox_to_idx").on(t.to, t.createdAt)],
);

/* Saved searches & category alerts ----------------------------- */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    q: text("q"),
    category: text("category"),
    condition: text("condition"),
    min: bigint("min", { mode: "number" }),
    max: bigint("max", { mode: "number" }),
    alert: boolean("alert").notNull().default(true),
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

/* Followed sellers -------------------------------------------- */
export const followedSellers = pgTable(
  "followed_sellers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sellerId] })],
);

/* Reports: lots and sellers ------------------------------------ */
export const reports = pgTable(
  "reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    reporterId: uuid("reporter_id").references(() => users.id),
    targetType: text("target_type").notNull(), // lot | seller
    lotId: uuid("lot_id"),
    sellerId: uuid("seller_id"),
    reason: text("reason").notNull(),
    message: text("message").notNull().default(""),
    status: text("status").notNull().default("open"), // open | resolved | dismissed
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

/* Disputes ----------------------------------------------------- */
export const disputes = pgTable(
  "disputes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id").notNull(),
    openedById: uuid("opened_by_id"),
    openedByAlias: text("opened_by_alias"),
    reason: text("reason").notNull(),
    evidence: text("evidence").notNull().default(""),
    status: text("status").notNull().default("open"), // open | resolved
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("disputes_status_idx").on(t.status)],
);

/* Immutable administrator audit trail -------------------------- */
export const adminEvents = pgTable(
  "admin_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    adminId: uuid("admin_id").notNull(),
    adminAlias: text("admin_alias").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    reason: text("reason"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("admin_events_action_idx").on(t.action)],
);

export type LotRow = typeof lots.$inferSelect;
export type BidRow = typeof bids.$inferSelect;
export type UserRow = typeof users.$inferSelect;
