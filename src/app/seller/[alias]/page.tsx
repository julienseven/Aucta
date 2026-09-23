import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import {
  getPublicSeller,
  getPublicSellerLots,
  getSellerTransactionHistory,
} from "@/lib/seller";
import { LotCard } from "@/components/LotCard";
import { getWatchIds } from "@/lib/auctions";
import { ReportDialog } from "@/components/ReportDialog";
import { FollowSellerButton } from "@/components/FollowSellerButton";
import { isFollowing } from "@/lib/collector";
import { Reveal } from "@/components/Reveal";
import { formatRupiah } from "@/lib/format";
import {
  IconClock,
  IconShieldCheck,
  IconStore,
  IconTarget,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ alias: string }>;
}): Promise<Metadata> {
  const { alias } = await params;
  const seller = await getPublicSeller(decodeURIComponent(alias));
  return { title: seller ? `${seller.alias} — Seller` : "Seller not found" };
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ alias: string }>;
}) {
  const { alias } = await params;
  const seller = await getPublicSeller(decodeURIComponent(alias));
  if (!seller) notFound();

  const [{ dict }, lots, history, viewer] = await Promise.all([
    getDict(),
    getPublicSellerLots(seller.id),
    getSellerTransactionHistory(seller.id),
    getSessionUser().catch(() => null),
  ]);
  const watchIds = viewer ? await getWatchIds(viewer.id) : [];
  const followingRows = viewer
    ? await isFollowing(viewer.id, seller.id)
    : [];
  const t = dict.trust;
  const m = seller.metrics ?? {};
  const verified = seller.sellerVerified;

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-12 sm:px-6 lg:px-10">
      {/* Profile header */}
      <Reveal>
        <div className="surface flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-espresso font-serif text-3xl text-canvas">
            {seller.alias.slice(0, 1)}
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl">
                {seller.displayName ?? seller.alias}
              </h1>
              {verified ? (
                <span className="badge badge-success">
                  <IconShieldCheck size={13} /> {t.verified}
                </span>
              ) : seller.sellerStatus === "pending" ? (
                <span className="badge badge-upcoming">{t.verificationPending}</span>
              ) : (
                <span className="badge badge-muted">{t.notVerified}</span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">@{seller.alias}</p>
            {seller.sellerBio && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-ink">
                {seller.sellerBio}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              <IconStore size={13} className="mr-1 inline" />
              {seller.sellerCity}, {seller.sellerProvince} · {t.memberSince}{" "}
              {seller.createdAt.toLocaleDateString("en-GB", {
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {viewer && viewer.id !== seller.id && (
              <FollowSellerButton
                sellerId={seller.id}
                initial={followingRows.length > 0}
                signedIn={Boolean(viewer)}
                nextPath={`/seller/${seller.alias}`}
              />
            )}
            <ReportDialog
              variant="seller"
              target={{ sellerId: seller.id }}
              signedIn={Boolean(viewer)}
            />
          </div>
        </div>
      </Reveal>

      {/* Trust metrics */}
      <Reveal delay={100}>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={<IconTarget size={16} />} label={t.successfulSales} value={String(m.successfulSales ?? history.filter((h) => h.status === "completed").length)} />
          <Metric icon={<IconClock size={16} />} label={t.responseTime} value={m.responseHours != null ? `${m.responseHours} h` : "—"} />
          <Metric icon={<IconClock size={16} />} label={t.shippingTime} value={m.shippingHours != null ? `${m.shippingHours} h` : "—"} />
          <Metric
            icon={<IconShieldCheck size={16} />}
            label={t.rating}
            value={m.ratingAvg ? `★ ${m.ratingAvg.toFixed(1)} (${m.ratingsCount ?? 0})` : "—"}
          />
        </dl>
      </Reveal>

      {/* Active lots */}
      {lots.length > 0 && (
        <section className="mt-14">
          <Reveal className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-2xl">{t.viewListings}</h2>
            <span className="text-sm text-muted">{lots.length} lots</span>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {lots.map((lot, i) => (
              <Reveal as="div" key={lot.id} delay={Math.min(i * 50, 400)}>
                <LotCard
                  lot={lot}
                  watching={watchIds.includes(lot.id)}
                  signedIn={Boolean(viewer)}
                  dict={dict}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Transaction history */}
      <section className="mt-14">
        <Reveal className="mb-5">
          <h2 className="font-serif text-2xl">{t.transactionHistory}</h2>
        </Reveal>
        {history.length === 0 ? (
          <div className="surface-soft p-8 text-center text-sm text-muted-ink">
            {t.noHistory}
          </div>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-line bg-cream text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Object</th>
                  <th className="px-5 py-3 text-right font-semibold">Hammer</th>
                  <th className="px-5 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.number} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{h.number}</td>
                    <td className="px-5 py-3">
                      <Link href={`/auctions/${h.slug}`} className="flex items-center gap-3 hover:underline">
                        <span className="relative h-9 w-9 overflow-hidden rounded bg-soft">
                          <Image src={h.image} alt="" fill sizes="36px" className="object-cover" />
                        </span>
                        <span className="line-clamp-1">{h.title}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold">
                      {formatRupiah(Number(h.hammer))}
                    </td>
                    <td className="px-5 py-3 text-right text-xs capitalize">
                      <span className="badge badge-success">{h.status.replace("_", " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface p-5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-soft text-bronze-deep">
        {icon}
      </span>
      <dd className="mt-3 font-serif text-2xl">{value}</dd>
      <dt className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
    </div>
  );
}
