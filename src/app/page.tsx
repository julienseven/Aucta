import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { lots } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { categories } from "@/lib/config";
import { getDict } from "@/lib/i18n/server";
import { Reveal } from "@/components/Reveal";
import { LotCard } from "@/components/LotCard";
import { Countdown } from "@/components/Countdown";
import { getWatchIds } from "@/lib/auctions";
import { recommendFor } from "@/lib/collector";
import { getSessionUser } from "@/lib/auth";
import { RecentlyViewedRail } from "@/components/RecentlyViewed";
import {
  IconArrow,
  IconBulb,
  IconGavel,
  IconShield,
  IconTarget,
  categoryIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ dict }, liveLots, counts, user] = await Promise.all([
    getDict(),
    db
      .select()
      .from(lots)
      .where(eq(lots.status, "live"))
      .orderBy(asc(lots.endsAt))
      .limit(8),
    db
      .select({ category: lots.category, n: sql<number>`count(*)::int` })
      .from(lots)
      .where(sql`${lots.status} IN ('live','upcoming')`)
      .groupBy(lots.category),
    getSessionUser().catch(() => null),
  ]);
  const watchIds = user ? await getWatchIds(user.id).catch(() => []) : [];
  const recommended = await recommendFor(user?.id ?? null);
  const countMap = new Map(counts.map((c) => [c.category, Number(c.n)]));
  const liveCount = liveLots.length;
  const h = dict.home;

  const steps = [
    {
      n: "01",
      title: h.step1Title,
      body: h.step1Body,
      href: "/seller-policy",
      cta: dict.nav.sellerStandards,
      icon: IconShield,
    },
    {
      n: "02",
      title: h.step2Title,
      body: h.step2Body,
      href: "/auction-rules",
      cta: dict.nav.howBidding,
      icon: IconGavel,
    },
    {
      n: "03",
      title: h.step3Title,
      body: h.step3Body,
      href: "/buyer-protection",
      cta: dict.nav.buyerProtection,
      icon: IconBulb,
    },
  ];

  return (
    <div className="page-enter overflow-x-clip">
      {/* ============================ HERO ============================ */}
      <section className="relative">
        <div className="mx-auto grid w-full max-w-[94rem] items-center gap-10 px-4 pb-14 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-10 lg:pb-24 lg:pt-14">
          <div>
            <Reveal>
              <p className="eyebrow">{h.eyebrow}</p>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="mt-6 font-serif text-[clamp(2.8rem,7.2vw,5.6rem)] font-semibold leading-[0.95] tracking-[-0.02em]">
                {h.titleA}
                <br />
                <span className="serif-italic font-medium">{h.titleB}</span>
              </h1>
            </Reveal>
            <Reveal delay={170}>
              <p className="lede mt-7 max-w-xl">{h.lede}</p>
            </Reveal>
            <Reveal delay={250}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/auctions" className="btn btn-primary btn-lg">
                  {h.ctaExplore}
                  <IconArrow size={17} className="arrow" />
                </Link>
                <Link href="/auction-rules" className="btn btn-outline btn-lg">
                  {h.ctaHow}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={330}>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6 sm:gap-6">
                {[
                  { k: h.statProxyK, v: h.statProxyV },
                  { k: h.statSnipeK, v: h.statSnipeV },
                  { k: h.statFeeK, v: h.statFeeV },
                ].map((s) => (
                  <div key={s.k}>
                    <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted sm:text-[0.64rem]">
                      {s.k}
                    </dt>
                    <dd className="mt-1 font-serif text-base text-ink sm:text-lg">
                      {s.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative">
            <div className="relative">
              <div className="grain overflow-hidden rounded-[var(--radius-xl)] border border-line shadow-[var(--shadow-lift)]">
                <Image
                  src="/images/aucta-editorial-hero.png"
                  alt=""
                  width={1200}
                  height={1400}
                  priority
                  sizes="(max-width: 1024px) 92vw, 44vw"
                  className="aspect-[5/6] w-full object-cover"
                />
              </div>

              {/* Floating live indicator — guides attention */}
              <Link
                href="/auctions"
                className="animate-float absolute -left-1 top-6 flex items-center gap-3 rounded-2xl border border-line bg-canvas/95 px-3.5 py-2.5 shadow-[var(--shadow-card)] backdrop-blur sm:-left-8 sm:px-4 sm:py-3"
              >
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-oxblood-soft text-oxblood">
                  <span className="live-dot" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">
                    {liveCount} {h.liveNow}
                  </span>
                  <span className="block text-[0.68rem] text-muted">{h.liveSub}</span>
                </span>
              </Link>

              {liveLots[0] && (
                <div className="absolute -bottom-5 -right-1 hidden rounded-2xl border border-line bg-canvas/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur sm:block sm:-right-5">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
                    {h.nextClose}
                  </p>
                  <div className="mt-1 text-oxblood">
                    <Countdown endsAt={liveLots[0].endsAt.toISOString()} />
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
        <div className="ornament mx-auto max-w-xs text-[0.7rem] font-semibold uppercase tracking-[0.3em]">
          {h.curiosity}
        </div>
      </section>

      {/* =========================== LIVE RAIL ======================= */}
      <section className="mx-auto w-full max-w-[94rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{h.onTheFloor}</p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
              {h.closingSoon}{" "}
              <span className="serif-italic font-medium">{h.closingSoonest}</span>
            </h2>
          </div>
          <Link href="/auctions" className="link-arrow">
            {h.browseAll} <IconArrow size={16} className="arrow" />
          </Link>
        </Reveal>

        {liveLots.length === 0 ? (
          <div className="surface-soft p-8 text-center text-muted-ink">
            {h.noLive}{" "}
            <Link
              href="/auctions?status=upcoming"
              className="font-semibold text-ink underline-offset-4 hover:underline"
            >
              {h.seeUpcoming}
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {liveLots.slice(0, 4).map((lot, i) => (
              <Reveal as="div" key={lot.id} delay={i * 70}>
                <LotCard
                  lot={lot}
                  watching={watchIds.includes(lot.id)}
                  signedIn={Boolean(user)}
                  dict={dict}
                />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ========================= CATEGORIES ======================= */}
      <section className="border-y border-line bg-paper-deep">
        <div className="mx-auto w-full max-w-[94rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
          <Reveal className="mb-9 text-center">
            <p className="eyebrow justify-center">{h.twoWays}</p>
            <h2 className="mx-auto mt-3 max-w-xl font-serif text-3xl sm:text-4xl">
              {h.browseBy}{" "}
              <span className="serif-italic font-medium">{h.browseByTail}</span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-8">
            {categories.map((c, i) => {
              const Icon = categoryIcon[c.slug];
              return (
                <Reveal as="div" key={c.slug} delay={i * 45}>
                  <Link
                    href={`/auctions?category=${c.slug}`}
                    className="group flex h-full flex-col gap-3 rounded-card border border-line bg-canvas p-5 transition-all duration-300 hover:-translate-y-1 hover:border-bronze-soft hover:shadow-[var(--shadow-card)]"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-cream text-bronze-deep transition-all duration-300 group-hover:bg-bronze group-hover:text-white">
                      <Icon size={20} />
                    </span>
                    <span className="font-serif text-lg font-semibold">
                      {c.label}
                    </span>
                    <span className="text-xs leading-snug text-muted">
                      {h.catBlurbs[c.slug as keyof typeof h.catBlurbs] ?? c.blurb}
                    </span>
                    <span className="mt-auto text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-bronze-deep">
                      {countMap.get(c.slug) ?? 0} {h.openCount}
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================= EDITORIAL ======================== */}
      <section className="mx-auto w-full max-w-[94rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="grain overflow-hidden rounded-[var(--radius-xl)] border border-line shadow-[var(--shadow-card)]">
              <Image
                src="/images/aucta-watch-editorial.png"
                alt=""
                width={1000}
                height={900}
                sizes="(max-width: 1024px) 92vw, 44vw"
                className="aspect-[6/5] w-full object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="eyebrow">{h.editorialEyebrow}</p>
            <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-[2.6rem]">
              {h.editorialTitleA}{" "}
              <span className="serif-italic font-medium">{h.editorialTitleB}</span>.
            </h2>
            <p className="lede mt-5">{h.editorialBody}</p>
            <p className="mt-3 text-sm text-muted">{h.editorialNote}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/auctions" className="btn btn-primary">
                {h.ctaExplore} <IconArrow size={16} className="arrow" />
              </Link>
              <Link href="/sold" className="btn btn-outline">
                {h.pastResults}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================= RECOMMENDATIONS ====================== */}
      {recommended.length > 0 && (
        <section className="mx-auto w-full max-w-[94rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">
                {user ? "Picked for you" : "Most watched"}
              </p>
              <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
                {user ? (
                  <>
                    Because of what you{" "}
                    <span className="serif-italic font-medium">watch</span>
                  </>
                ) : (
                  <>
                    What collectors are{" "}
                    <span className="serif-italic font-medium">watching</span>
                  </>
                )}
              </h2>
            </div>
            <Link href="/auctions" className="link-arrow">
              {h.browseAll} <IconArrow size={16} className="arrow" />
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {recommended.slice(0, 5).map((lot, i) => (
              <Reveal as="div" key={lot.id} delay={i * 60}>
                <LotCard
                  lot={lot}
                  watching={watchIds.includes(lot.id)}
                  signedIn={Boolean(user)}
                  dict={dict}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ========================= HOW IT WORKS ===================== */}
      <section className="border-t border-line bg-cream">
        <div className="mx-auto w-full max-w-[94rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <Reveal className="mb-12 max-w-2xl">
            <p className="eyebrow">{h.howEyebrow}</p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
              {h.howTitleA}{" "}
              <span className="serif-italic font-medium">{h.howTitleB}</span>.
            </h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal as="article" key={s.n} delay={i * 110}>
                <div className="group flex h-full flex-col rounded-card border border-line bg-canvas p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
                  <div className="flex items-center justify-between">
                    <span className="medallion">{s.n}</span>
                    <s.icon
                      size={26}
                      className="text-bronze-soft transition-colors duration-300 group-hover:text-bronze"
                    />
                  </div>
                  <h3 className="mt-6 font-serif text-2xl">{s.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-ink">
                    {s.body}
                  </p>
                  <Link href={s.href} className="link-arrow mt-6">
                    {s.cta} <IconArrow size={15} className="arrow" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ CTA =========================== */}
      <section className="relative overflow-hidden bg-ink text-canvas">
        <Image
          src="/images/aucta-design-editorial.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-20"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-24">
          <Reveal>
            <IconTarget size={30} className="mx-auto text-bronze-soft" />
            <h2 className="mt-6 font-serif text-[clamp(2rem,5vw,3.4rem)] leading-tight">
              {h.ctaTitleA}
              <br />
              <span className="font-serif italic text-bronze-soft">
                {h.ctaTitleB}
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-canvas/70">{h.ctaBody}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/sell" className="btn btn-bronze btn-lg">
                {h.ctaSell} <IconArrow size={17} className="arrow" />
              </Link>
              <Link
                href="/auctions"
                className="btn btn-lg border border-canvas/25 bg-transparent text-canvas hover:bg-canvas/10"
              >
                {h.ctaBrowse}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <RecentlyViewedRail />
    </div>
  );
}
