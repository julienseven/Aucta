import Link from "next/link";
import Image from "next/image";
import { categoryMap } from "@/lib/config";
import { formatRupiah } from "@/lib/format";
import type { LotRow } from "@/db/schema";
import type { Dict } from "@/lib/i18n/dict";
import { Countdown } from "@/components/Countdown";
import { WatchButton } from "@/components/WatchButton";
import { IconEye } from "@/components/icons";

export function LotCard({
  lot,
  watching = false,
  signedIn = false,
  dict,
}: {
  lot: LotRow;
  watching?: boolean;
  signedIn?: boolean;
  dict: Dict;
}) {
  const isSold = lot.status === "sold";
  const isUpcoming = lot.status === "upcoming";
  const reserveMet =
    lot.reserveAmount == null || lot.currentAmount >= Number(lot.reserveAmount);

  return (
    <article className="lot-card group relative h-full">
      <div className="absolute right-2.5 top-2.5 z-20">
        <WatchButton
          lotId={lot.id}
          initialWatching={watching}
          signedIn={signedIn}
        />
      </div>
      <Link
        href={`/auctions/${lot.slug}`}
        className="card-media relative block aspect-square"
        aria-label={lot.title}
      >
        <Image
          src={lot.image}
          alt={lot.title}
          fill
          sizes="(max-width: 640px) 48vw, (max-width: 1280px) 30vw, 19vw"
          className="object-cover"
        />
        <span className="absolute left-3 top-3">
          {lot.status === "live" && (
            <span className="badge badge-live backdrop-blur-sm">
              <span className="live-dot" /> {dict.common.live}
            </span>
          )}
          {lot.status === "upcoming" && (
            <span className="badge badge-upcoming">{dict.common.upcoming}</span>
          )}
          {isSold && <span className="badge badge-sold">{dict.common.sold}</span>}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <div className="flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-bronze-deep">
          <span className="truncate">
            {categoryMap[lot.category as keyof typeof categoryMap]?.label ?? lot.category}
          </span>
          <span className="text-line">•</span>
          <span className="shrink-0 text-muted">{lot.condition}</span>
        </div>

        <h3 className="font-serif text-[1.02rem] font-semibold leading-snug text-ink">
          <Link
            href={`/auctions/${lot.slug}`}
            className="after:absolute after:inset-0"
          >
            {lot.title}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="min-w-0">
            <div className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">
              {isSold
                ? dict.common.hammerPrice
                : isUpcoming
                  ? dict.common.openBid
                  : dict.common.currentBid}
            </div>
            <div className="truncate font-mono text-[0.95rem] font-semibold tabular-nums text-ink">
              {formatRupiah(
                Number(
                  isSold ? lot.soldAmount ?? lot.currentAmount : lot.currentAmount,
                ),
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {lot.status === "live" && (
              <Countdown endsAt={lot.endsAt.toISOString()} />
            )}
            {lot.status === "live" && !reserveMet && (
              <div className="mt-1 whitespace-nowrap text-[0.64rem] font-medium text-amber">
                {dict.card.reserveNotMet}
              </div>
            )}
            {isUpcoming && (
              <div className="whitespace-nowrap text-[0.68rem] text-muted">
                {dict.common.opens}{" "}
                {new Date(lot.startsAt).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "short" },
                )}
              </div>
            )}
            {isSold && (
              <div className="inline-flex items-center gap-1 whitespace-nowrap text-[0.68rem] text-muted">
                <IconEye size={12} /> {lot.bidCount} {dict.common.bids}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
