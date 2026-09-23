import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { getWatchIds, getWatchlistLots } from "@/lib/auctions";
import { LotCard } from "@/components/LotCard";
import { Reveal } from "@/components/Reveal";
import { IconArrow, IconHeart } from "@/components/icons";

export const metadata: Metadata = {
  title: "Your watchlist",
  description: "The lots you are following on AUCTA.",
};

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const [user, { dict }] = await Promise.all([
    getSessionUser().catch(() => null),
    getDict(),
  ]);
  const w = dict.watch;

  if (!user) {
    return (
      <div className="page-enter mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-soft text-bronze-deep">
          <IconHeart size={28} />
        </span>
        <h1 className="mt-6 font-serif text-3xl">{w.needTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-ink">{w.needBody}</p>
        <Link
          href="/sign-in?next=/watchlist"
          className="btn btn-primary btn-lg mt-7"
        >
          {dict.nav.signIn} <IconArrow size={16} className="arrow" />
        </Link>
      </div>
    );
  }

  const [watched, watchIds] = await Promise.all([
    getWatchlistLots(user.id),
    getWatchIds(user.id),
  ]);

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-12 sm:px-6 lg:px-10">
      <Reveal>
        <p className="eyebrow">{w.following}</p>
        <h1 className="mt-4 font-serif text-[clamp(2.2rem,5vw,3.6rem)]">
          {w.titleA} <span className="serif-italic font-medium">{w.titleB}</span>
        </h1>
        <p className="lede mt-4">
          {watched.length === 0
            ? w.emptyCount
            : `${watched.length} ${
                watched.length === 1
                  ? `${dict.common.lot} ${w.countOne}`
                  : `${dict.common.lots} ${w.countMany}`
              }`}
        </p>
      </Reveal>

      {watched.length === 0 ? (
        <div className="surface-soft mt-10 flex flex-col items-center gap-4 px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-canvas text-bronze-deep">
            <IconHeart size={24} />
          </span>
          <div>
            <h2 className="font-serif text-2xl">{w.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-ink">
              {w.emptyBody}
            </p>
          </div>
          <Link href="/auctions" className="btn btn-primary">
            {w.explore} <IconArrow size={16} className="arrow" />
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {watched.map((lot, i) => (
            <Reveal as="div" key={lot.id} delay={Math.min(i * 50, 400)}>
              <LotCard
                lot={lot}
                watching={watchIds.includes(lot.id)}
                signedIn
                dict={dict}
              />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
