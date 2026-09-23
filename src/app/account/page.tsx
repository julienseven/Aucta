import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { bids, lots, orders, watchlist } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { SignOutButton } from "@/components/SignOutButton";
import { LotCard } from "@/components/LotCard";
import { OrdersPanel, type OrderRow } from "@/components/OrdersPanel";
import { getWatchIds } from "@/lib/auctions";
import { formatRupiah } from "@/lib/format";
import { Reveal } from "@/components/Reveal";
import {
  IconArrow,
  IconBell,
  IconGavel,
  IconHeart,
  IconList,
  IconUser,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your alias, bids and watched lots on AUCTA.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, user, { dict }] = await Promise.all([
    searchParams,
    getSessionUser().catch(() => null),
    getDict(),
  ]);
  const t = dict.account;

  if (!user) {
    return (
      <div className="page-enter mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-soft text-bronze-deep">
          <IconUser size={28} />
        </span>
        <h1 className="mt-6 font-serif text-3xl">{t.needSignInTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-ink">
          {t.needSignInBody}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-in?next=/account"
            className="btn btn-primary btn-lg"
          >
            {t.signIn} <IconArrow size={16} className="arrow" />
          </Link>
          <Link href="/auctions" className="btn btn-outline btn-lg">
            {dict.nav.auctions}
          </Link>
        </div>
      </div>
    );
  }

  const [myBids, watchedRows, leadingRows] = await Promise.all([
    db
      .select({
        id: bids.id,
        maxAmount: bids.maxAmount,
        createdAt: bids.createdAt,
        lot: lots,
      })
      .from(bids)
      .innerJoin(lots, eq(bids.lotId, lots.id))
      .where(eq(bids.userId, user.id))
      .orderBy(desc(bids.createdAt))
      .limit(8),
    db
      .select({ lot: lots })
      .from(watchlist)
      .innerJoin(lots, eq(watchlist.lotId, lots.id))
      .where(eq(watchlist.userId, user.id))
      .orderBy(desc(watchlist.createdAt))
      .limit(4),
    db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.leadingAlias, user.alias), eq(lots.status, "live"))),
  ]);
  const watchIds = await getWatchIds(user.id);
  const watched = watchedRows.map(
    (r) => r.lot as unknown as typeof lots.$inferSelect,
  );

  const orderRows = await db
    .select({ order: orders, lot: lots })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .where(
      or(eq(orders.buyerId, user.id), eq(lots.ownerId, user.id)),
    )
    .orderBy(desc(orders.createdAt));
  const orderData: OrderRow[] = orderRows.map(({ order, lot }) => ({
    id: order.id,
    number: order.number,
    status: order.status,
    hammerAmount: Number(order.hammerAmount),
    shippingCost: Number(order.shippingCost),
    amountDue: Number(order.amountDue),
    trackingNumber: order.trackingNumber,
    carrier: order.carrier,
    carrierStatus: order.carrierStatus,
    shipmentProof: order.shipmentProof,
    shippingLabel: order.shippingLabel,
    shippingAddress: order.shippingAddress,
    statusReason: order.statusReason,
    paymentExpiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    paymentDueAt: order.paymentDueAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    refundedAt: order.refundedAt?.toISOString() ?? null,
    title: lot.title,
    slug: lot.slug,
    image: lot.image,
    role: order.buyerId === user.id ? "buyer" : "seller",
  }));

  const stats = [
    { label: t.watching, value: watchIds.length, icon: IconHeart },
    { label: t.bidsPlaced, value: myBids.length, icon: IconGavel },
    { label: t.leadingNow, value: leadingRows.length, icon: IconArrow },
    {
      label: t.verification,
      value: user.sellerVerified ? t.verified : t.collector,
      icon: IconUser,
    },
  ];

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-12 sm:px-6 lg:px-10">
      <Reveal>
        <p className="eyebrow">{t.title}</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-espresso font-serif text-2xl text-canvas sm:h-16 sm:w-16">
              {user.alias.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl sm:text-3xl">
                {user.alias}
              </h1>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-6 flex flex-wrap gap-2">
          <TabLink href="/account" active={tab !== "orders"}>
            <IconUser size={14} /> Overview
          </TabLink>
          <TabLink href="/account?tab=orders" active={tab === "orders"}>
            <IconList size={14} /> Orders
            {orderData.length > 0 && (
              <span className="rounded-full bg-soft px-1.5 text-[0.62rem] font-bold">
                {orderData.length}
              </span>
            )}
          </TabLink>
          <TabLink href="/alerts">
            <IconBell size={14} /> Alerts
          </TabLink>
        </div>
      </Reveal>

      {tab === "orders" ? (
        <section className="mt-10">
          <OrdersPanel orders={orderData} />
        </section>
      ) : (
        <>
      <Reveal delay={100}>
        <dl className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="surface p-5">
              <s.icon size={18} className="text-bronze-deep" />
              <dd className="mt-3 font-serif text-2xl">{s.value}</dd>
              <dt className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </Reveal>

      <section className="mt-14">
        <Reveal className="mb-5 flex items-end justify-between">
          <h2 className="font-serif text-2xl">{t.recentBids}</h2>
        </Reveal>
        {myBids.length === 0 ? (
          <div className="surface-soft p-8 text-center text-sm text-muted-ink">
            {t.noBids}{" "}
            <Link
              href="/auctions"
              className="font-semibold text-espresso underline-offset-4 hover:underline"
            >
              {t.explore}
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-canvas">
            {myBids.map((b) => {
              const lot = b.lot as unknown as typeof lots.$inferSelect;
              return (
                <Link
                  key={b.id}
                  href={`/auctions/${lot.slug}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line-soft px-4 py-3.5 text-sm transition-colors last:border-0 hover:bg-cream sm:gap-4 sm:px-5"
                >
                  <span className="truncate font-medium">{lot.title}</span>
                  <span className="font-mono text-xs text-muted">
                    {t.maxLabel} {formatRupiah(Number(b.maxAmount))}
                  </span>
                  <span className="text-xs text-muted">
                    {b.createdAt.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-14">
        <Reveal className="mb-5 flex items-end justify-between">
          <h2 className="font-serif text-2xl">{t.watching}</h2>
          <Link href="/watchlist" className="link-arrow">
            {dict.nav.watchlist} <IconArrow size={15} className="arrow" />
          </Link>
        </Reveal>
        {watched.length === 0 ? (
          <div className="surface-soft p-8 text-center text-sm text-muted-ink">
            {dict.watch.emptyBody}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {watched.map((lot) => (
              <LotCard
                key={lot.id}
                lot={lot}
                watching
                signedIn
                dict={dict}
              />
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
        active
          ? "border-ink bg-ink text-canvas"
          : "border-line bg-canvas text-muted-ink hover:border-bronze-soft"
      }`}
    >
      {children}
    </Link>
  );
}
