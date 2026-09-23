"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/LanguageProvider";
import {
  DashboardShell,
  KpiCard,
  ListingStageBadge,
  Bars,
} from "@/components/dashboard/primitives";
import { NewListingButton } from "@/components/seller/NewListingButton";
import { formatRupiah } from "@/lib/format";
import {
  IconArrow,
  IconBell,
  IconChart,
  IconCheck,
  IconClock,
  IconEye,
  IconGavel,
  IconList,
  IconShieldCheck,
  IconStore,
} from "@/components/icons";

export function SellerDesk({
  user,
  listings,
  stats,
  history,
  weeks,
}: {
  user: any;
  listings: any[];
  stats: any;
  history: any[];
  weeks: { label: string; value: number }[];
}) {
  const { dict } = useI18n();
  const hasSales = weeks.some((w) => w.value > 0);

  const nav = [
    { href: "/sell", label: "Overview", icon: IconChart },
    { href: "/sell", label: dict.seller.listings, icon: IconList },
    { href: "/sell/verification", label: dict.seller.verification, icon: IconShieldCheck },
    { href: "/account", label: dict.nav.account, icon: IconStore },
  ];

  const funnel = [
    { label: dict.seller.drafts, value: stats.drafts, color: "var(--color-faint)" },
    { label: dict.seller.inReview, value: stats.inReview, color: "var(--color-clay)" },
    { label: dict.seller.active, value: stats.active, color: "var(--color-bronze)" },
    { label: dict.seller.sold, value: stats.sold, color: "var(--color-success)" },
    { label: dict.seller.rejected, value: stats.rejected, color: "var(--color-oxblood)" },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <DashboardShell
      brand={
        <div>
          <p className="eyebrow is-clean">{dict.seller.title}</p>
          <p className="mt-2 font-serif text-xl leading-tight">
            {user.displayName ?? user.alias}
          </p>
          <p className="text-xs text-muted">{user.sellerCity ?? "Indonesia"}</p>
        </div>
      }
      nav={nav}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[clamp(1.8rem,4vw,2.6rem)]">
            {user.sellerStatus === "verified"
              ? dict.seller.title
              : dict.seller.title}
          </h1>
          <p className="mt-1 text-sm text-muted-ink">{dict.seller.subtitle}</p>
        </div>
        <NewListingButton className="btn-lg" />
      </div>

      {user.sellerStatus !== "verified" && (
        <div
          className={`mb-6 flex flex-col gap-4 rounded-card border p-5 sm:flex-row sm:items-center ${
            user.sellerStatus === "pending"
              ? "border-amber/30 bg-amber-soft"
              : "border-line bg-cream"
          }`}
        >
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
              user.sellerStatus === "pending"
                ? "bg-canvas text-amber"
                : "bg-amber-soft text-bronze-deep"
            }`}
          >
            {user.sellerStatus === "pending" ? (
              <IconClock size={20} />
            ) : (
              <IconShieldCheck size={20} />
            )}
          </span>
          <div className="flex-1">
            <p className="font-serif text-lg">
              {user.sellerStatus === "pending"
                ? dict.seller.pendingTitle
                : dict.seller.verificationCtaTitle}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-ink">
              {user.sellerStatus === "pending"
                ? dict.seller.pendingBody
                : dict.seller.verificationCtaBody}
            </p>
          </div>
          {user.sellerStatus !== "pending" && (
            <Link href="/sell/verification" className="btn btn-primary shrink-0">
              {dict.seller.startVerification} <IconArrow size={15} className="arrow" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label={dict.seller.active} value={stats.active} icon={IconGavel} tone="bronze" />
        <KpiCard label={dict.seller.inReview} value={stats.inReview} icon={IconBell} tone={stats.inReview ? "red" : "ink"} />
        <KpiCard label={dict.seller.drafts} value={stats.drafts} icon={IconList} tone="ink" />
        <KpiCard
          label={dict.trust.successfulSales}
          value={stats.successfulSales}
          icon={IconCheck}
          tone="green"
          delta={stats.ratingAvg != null ? `★ ${Number(stats.ratingAvg).toFixed(1)}` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-lg">{dict.seller.hammerVolume}</h2>
            <span className="text-xs text-muted">8 weeks</span>
          </div>
          {hasSales ? (
            <Bars data={weeks} format={(n) => formatRupiah(n, { compact: true })} />
          ) : (
            <div className="grid h-40 place-items-center rounded-lg bg-cream text-center text-xs text-muted">
              Hammer volume appears here as consignments close.
            </div>
          )}
        </div>
        <div className="surface p-5 sm:p-6">
          <h2 className="mb-5 font-serif text-lg">{dict.seller.funnel}</h2>
          <ul className="space-y-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-ink">{f.label}</span>
                  <span className="font-mono font-semibold">{f.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max((f.value / funnelMax) * 100, f.value ? 8 : 2)}%`,
                      background: f.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
            <div>
              <dt className="text-muted">{dict.trust.responseTime}</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {stats.responseHours != null ? `${stats.responseHours} h` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{dict.trust.shippingTime}</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {stats.shippingHours != null ? `${stats.shippingHours} h` : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-serif text-xl">{dict.seller.recentListings}</h2>
          <NewListingButton />
        </div>
        {listings.length === 0 ? (
          <div className="surface flex flex-col items-center gap-4 p-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-soft text-bronze-deep">
              <IconStore size={24} />
            </span>
            <div>
              <p className="font-serif text-xl">Nothing consigned yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-ink">
                {dict.seller.emptyDrafts}
              </p>
            </div>
            <NewListingButton className="btn-lg" />
          </div>
        ) : (
          <div className="surface overflow-hidden">
            {listings.map((l: any) => (
              <div
                key={l.id}
                className="grid grid-cols-[3rem_1fr] items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0 sm:px-5 md:grid-cols-[3rem_1fr_9rem_8rem_7rem]"
              >
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-soft">
                  <Image src={l.image} alt="" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.title}</p>
                  <p className="truncate text-xs text-muted">
                    {l.category} · {l.condition}
                    {l.reviewNote && <span className="text-oxblood"> · feedback</span>}
                  </p>
                </div>
                <div className="col-span-2 mt-2 md:col-span-1 md:mt-0">
                  <ListingStageBadge stage={l.stage} status={l.status} />
                </div>
                <p className="hidden text-right font-mono text-xs font-semibold md:block">
                  {l.status === "sold"
                    ? formatRupiah(Number(l.soldAmount ?? l.currentAmount))
                    : Number(l.startAmount) > 0
                      ? formatRupiah(Number(l.startAmount))
                      : "—"}
                </p>
                <div className="mt-2 flex justify-end md:mt-0">
                  <Link
                    href={`/sell/${l.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-espresso hover:text-bronze-deep"
                  >
                    {l.stage === "published" || ["live", "upcoming"].includes(l.status) ? (
                      <>
                        <IconEye size={14} /> View
                      </>
                    ) : (
                      <>
                        {dict.seller.continueDraft} <IconArrow size={13} className="arrow" />
                      </>
                    )}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-serif text-xl">{dict.trust.transactionHistory}</h2>
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Object</th>
                  <th className="px-5 py-3 text-right font-semibold">Hammer</th>
                  <th className="px-5 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.number} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{h.number}</td>
                    <td className="px-5 py-3">
                      <Link href={`/auctions/${h.slug}`} className="hover:underline">
                        {h.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold">
                      {formatRupiah(Number(h.hammer))}
                    </td>
                    <td className="px-5 py-3 text-right text-xs capitalize">
                      {String(h.status).replace("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
