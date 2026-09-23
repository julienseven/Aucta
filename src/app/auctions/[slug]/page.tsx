import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { lots, users } from "@/db/schema";
import { and, asc, eq, ne } from "drizzle-orm";
import { getBidHistory, getLotBySlug, getWatchIds } from "@/lib/auctions";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { categoryMap } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { BidPanel } from "@/components/BidPanel";
import { LotCard } from "@/components/LotCard";
import { ReportDialog } from "@/components/ReportDialog";
import { RecordView } from "@/components/RecentlyViewed";
import { Reveal } from "@/components/Reveal";
import {
  IconArrow,
  IconBulb,
  IconCheck,
  IconTag,
  IconShield,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lot = await getLotBySlug(slug);
  if (!lot) return { title: "Lot not found" };
  return {
    title: lot.title,
    description: lot.description.slice(0, 158),
  };
}

export default async function LotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lot = await getLotBySlug(slug);
  if (!lot) notFound();

  const [{ dict }, history, related, user, seller] = await Promise.all([
    getDict(),
    getBidHistory(lot.id),
    db
      .select()
      .from(lots)
      .where(and(eq(lots.category, lot.category), ne(lots.id, lot.id)))
      .orderBy(asc(lots.endsAt))
      .limit(5),
    getSessionUser().catch(() => null),
    lot.ownerId
      ? db
          .select()
          .from(users)
          .where(eq(users.id, lot.ownerId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  const watchIds = user ? await getWatchIds(user.id).catch(() => []) : [];
  const watching = watchIds.includes(lot.id);
  const cat = categoryMap[lot.category as keyof typeof categoryMap];
  const d = dict.lot;

  return (
    <div className="page-enter overflow-x-clip pb-24 md:pb-10">
      <RecordView
        item={{
          id: lot.id,
          slug: lot.slug,
          title: lot.title,
          image: lot.image,
          status: lot.status,
          current: Number(lot.currentAmount),
          sold: lot.soldAmount != null ? Number(lot.soldAmount) : null,
        }}
      />
      {/* Breadcrumb */}
      <div className="mx-auto w-full max-w-[94rem] px-4 pt-8 sm:px-6 lg:px-10">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-xs text-muted"
        >
          <Link href="/" className="hover:text-ink">
            {d.homeCrumb}
          </Link>
          <span>/</span>
          <Link href="/auctions" className="hover:text-ink">
            {dict.nav.auctions}
          </Link>
          <span>/</span>
          <Link
            href={`/auctions?category=${lot.category}`}
            className="hover:text-ink"
          >
            {cat?.label ?? lot.category}
          </Link>
          <span>/</span>
          <span className="max-w-[42vw] truncate text-muted-ink">{lot.title}</span>
        </nav>
      </div>

      <section className="mx-auto mt-6 grid w-full max-w-[94rem] gap-8 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-10">
        {/* Gallery */}
        <div>
          <Reveal>
            <div className="grain group relative overflow-hidden rounded-[var(--radius-lg)] border border-line bg-soft shadow-[var(--shadow-card)]">
              <Image
                src={lot.image}
                alt={lot.title}
                width={1100}
                height={1100}
                priority
                sizes="(max-width: 1024px) 100vw, 54vw"
                className="aspect-square w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
              />
              <span className="absolute left-4 top-4">
                {lot.status === "live" && (
                  <span className="badge badge-live">
                    <span className="live-dot" /> {dict.common.live}
                  </span>
                )}
                {lot.status === "upcoming" && (
                  <span className="badge badge-upcoming">{dict.common.upcoming}</span>
                )}
                {lot.status === "sold" && (
                  <span className="badge badge-sold">{dict.common.sold}</span>
                )}
              </span>
            </div>
          </Reveal>
        </div>

        {/* Summary + bid */}
        <div>
          <Reveal>
            <p className="eyebrow">
              {cat?.label} · {lot.condition}
            </p>
            <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.9rem)] font-semibold leading-[1.05]">
              {lot.title}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {d.consignedFrom} {lot.sellerCity}, {lot.sellerProvince}
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-6">
              <BidPanel
                lot={{
                  id: lot.id,
                  slug: lot.slug,
                  status: lot.status,
                  startAmount: Number(lot.startAmount),
                  currentAmount: Number(lot.currentAmount),
                  hasReserve: lot.reserveAmount != null,
                  reserveMet: lot.reserveAmount == null ||
                    Number(lot.currentAmount) >= Number(lot.reserveAmount),
                  leadingAlias: lot.leadingAlias,
                  bidCount: lot.bidCount,
                  watchCount: lot.watchCount,
                  endsAt: lot.endsAt.toISOString(),
                  startsAt: lot.startsAt.toISOString(),
                  incrementOverride: lot.incrementOverride
                    ? Number(lot.incrementOverride)
                    : null,
                }}
                signedIn={Boolean(user)}
                watching={watching}
                history={history.map((h) => ({
                  id: h.id,
                  alias: h.alias,
                  createdAt: h.createdAt.toISOString(),
                }))}
                dict={dict}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Details */}
      <section className="mx-auto mt-12 grid w-full max-w-[94rem] gap-10 px-4 sm:px-6 lg:mt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-10">
        <div className="space-y-10">
          <Reveal>
            <h2 className="font-serif text-2xl">{d.description}</h2>
            <p className="mt-4 leading-[1.75] text-ink-soft">{lot.description}</p>
          </Reveal>

          <Reveal delay={80}>
            <div className="surface-soft overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
                <IconBulb size={17} className="text-bronze-deep" />
                <h2 className="font-serif text-lg">{d.conditionReport}</h2>
              </div>
              <p className="px-5 py-4 text-sm leading-relaxed text-ink-soft">
                {lot.flaws || d.noFlaws}
              </p>
              {lot.provenance && (
                <div className="border-t border-line px-5 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
                    {d.provenance}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {lot.provenance}
                  </p>
                </div>
              )}
            </div>
          </Reveal>

          {/* Authenticity & tamper evidence */}
          {(lot.authenticity ||
            lot.imageHashes.length > 0 ||
            lot.reportCount > 0) && (
            <Reveal delay={120}>
              <div className="surface-soft overflow-hidden">
                <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
                  <IconShield size={17} className="text-success" />
                  <h2 className="font-serif text-lg">{dict.trust.authenticity}</h2>
                </div>
                <div className="space-y-4 px-5 py-4">
                  {lot.authenticity && (
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {lot.authenticity}
                    </p>
                  )}
                  {lot.imageHashes.length > 0 && (
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
                        {dict.trust.imageHash}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {lot.imageHashes.slice(0, 4).map((h, i) => (
                          <li
                            key={h}
                            className="font-mono text-[0.66rem] text-muted-ink"
                          >
                            photo {i + 1} · <span className="break-all">{h}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted">
                        {dict.trust.imageHashBody}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          )}

          {/* Bid history — public aliases, never private maximums */}
          <Reveal delay={140}>
            <h2 className="font-serif text-2xl">{d.biddingActivity}</h2>
            <div className="mt-4 overflow-x-auto rounded-card border border-line">
              <div className="min-w-[26rem]">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-line bg-cream px-5 py-3 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted">
                  <span>{d.bidder}</span>
                  <span>{d.when}</span>
                  <span className="w-24 text-right">Proxy</span>
                </div>
                {history.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted">{d.noBids}</p>
                ) : (
                  history.map((h, i) => (
                    <div
                      key={h.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line-soft px-5 py-3 text-sm last:border-0"
                    >
                      <span className="flex items-center gap-2 font-mono">
                        {i === 0 && lot.status === "live" && (
                          <span className="live-dot shrink-0" />
                        )}
                        <span className="truncate">{h.alias}</span>
                        {i === 0 && lot.status === "live" && (
                          <span className="badge badge-success !px-2 !py-0.5">
                            {d.leading}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(h.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="w-24 text-right font-mono text-xs text-muted-ink">
                        {d.proxyHidden}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Side: logistics & trust */}
        <aside className="space-y-5">
          {/* Seller identity & trust */}
          <Reveal delay={40}>
            <div className="surface p-6">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted">
                {dict.trust.soldBy}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-espresso font-serif text-lg text-canvas">
                  {(seller?.alias ?? lot.sellerAlias).slice(0, 1)}
                </span>
                <div className="min-w-0">
                  {seller ? (
                    <Link
                      href={`/seller/${seller.alias}`}
                      className="flex items-center gap-1.5 font-semibold hover:text-bronze-deep"
                    >
                      <span className="truncate">{seller.displayName ?? seller.alias}</span>
                      {seller.sellerVerified && (
                        <IconShield size={15} className="shrink-0 text-success" />
                      )}
                    </Link>
                  ) : (
                    <p className="flex items-center gap-1.5 font-semibold">
                      AUCTA House <IconShield size={15} className="text-success" />
                    </p>
                  )}
                  <p className="truncate text-xs text-muted">
                    {lot.sellerCity}, {lot.sellerProvince}
                  </p>
                </div>
              </div>
              {seller && (
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div>
                    <dd className="font-serif text-lg">
                      {seller.metrics?.successfulSales ?? 0}
                    </dd>
                    <dt className="text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                      {dict.trust.successfulSales}
                    </dt>
                  </div>
                  <div>
                    <dd className="font-serif text-lg">
                      {seller.metrics?.responseHours != null
                        ? `${seller.metrics.responseHours}h`
                        : "—"}
                    </dd>
                    <dt className="text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                      {dict.trust.responseTime}
                    </dt>
                  </div>
                  <div>
                    <dd className="font-serif text-lg">
                      {seller.metrics?.ratingAvg
                        ? `★${seller.metrics.ratingAvg}`
                        : "—"}
                    </dd>
                    <dt className="text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                      {dict.trust.rating}
                    </dt>
                  </div>
                </dl>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                {seller ? (
                  <Link
                    href={`/seller/${seller.alias}`}
                    className="link-arrow text-xs"
                  >
                    {dict.trust.sellerProfile} <IconArrow size={13} className="arrow" />
                  </Link>
                ) : (
                  <Link href="/seller-policy" className="link-arrow text-xs">
                    {dict.nav.sellerStandards} <IconArrow size={13} className="arrow" />
                  </Link>
                )}
                <ReportDialog
                  variant="lot"
                  target={{ lotId: lot.id, sellerId: seller?.id }}
                  signedIn={Boolean(user)}
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <div className="surface space-y-4 p-6 text-sm">
              <h3 className="font-serif text-xl">{d.saleDetails}</h3>
              <dl className="space-y-3">
                <Row label={d.rowCondition}>
                  <span className="inline-flex items-center gap-1.5">
                    <IconCheck size={14} className="text-success" /> {lot.condition}
                  </span>
                </Row>
                <Row label={d.rowCloses}>
                  <span>{formatDateTime(lot.endsAt.toISOString())}</span>
                </Row>
                <Row label="Anti-snipe">{d.rowAntiSnipe}</Row>
                <Row label={d.rowBuyerFee}>0%</Row>
                <Row label={d.rowPayment}>{d.rowPaymentVal}</Row>
                <Row label={d.rowShips}>
                  {lot.sellerCity}, {lot.sellerProvince}
                </Row>
              </dl>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="surface-soft space-y-3 p-6">
              <p className="flex items-center gap-2 font-semibold">
                <IconShield size={17} className="text-success" />{" "}
                {d.buyerProtectionTitle}
              </p>
              <p className="text-xs leading-relaxed text-muted-ink">
                {d.buyerProtectionBody}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/buyer-protection" className="link-arrow text-xs">
                  {dict.nav.buyerProtection} <IconArrow size={13} className="arrow" />
                </Link>
                <Link href="/auction-rules" className="link-arrow text-xs">
                  {dict.nav.howBidding} <IconArrow size={13} className="arrow" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="surface-soft space-y-3 p-6">
              <p className="flex items-center gap-2 font-semibold">
                <IconTag size={17} className="text-bronze-deep" />{" "}
                {d.sellerStandardsTitle}
              </p>
              <p className="text-xs leading-relaxed text-muted-ink">
                {d.sellerStandardsBody}
              </p>
              <Link href="/seller-policy" className="link-arrow text-xs">
                {dict.nav.sellerStandards} <IconArrow size={13} className="arrow" />
              </Link>
            </div>
          </Reveal>
        </aside>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto mt-16 w-full max-w-[94rem] px-4 sm:px-6 lg:mt-20 lg:px-10">
          <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-serif text-3xl">
              {d.moreFrom}{" "}
              <span className="serif-italic font-medium">{cat?.label}</span>
            </h2>
            <Link
              href={`/auctions?category=${lot.category}`}
              className="link-arrow"
            >
              {dict.common.viewAll} <IconArrow size={15} className="arrow" />
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {related.slice(0, 5).map((r, i) => (
              <Reveal as="div" key={r.id} delay={i * 70}>
                <LotCard
                  lot={r}
                  watching={watchIds.includes(r.id)}
                  signedIn={Boolean(user)}
                  dict={dict}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line-soft pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink-soft">{children}</dd>
    </div>
  );
}
