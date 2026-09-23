import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getSessionUser } from "@/lib/auth";
import {
  getSellerListings,
  getSellerStats,
  getSellerTransactionHistory,
} from "@/lib/seller";
import { SellerDesk } from "@/components/seller/SellerDesk";
import { Reveal } from "@/components/Reveal";
import { IconArrow } from "@/components/icons";

export const metadata: Metadata = {
  title: "Seller desk",
  description: "Draft, submit and track the objects you consign to AUCTA.",
};

export const dynamic = "force-dynamic";

function weeklySeries(history: { createdAt: Date; hammer: number | bigint }[]) {
  const weeks: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const value = history
      .filter((h) => h.createdAt >= start && h.createdAt < end)
      .reduce((a, h) => a + Number(h.hammer), 0);
    weeks.push({
      label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      value,
    });
  }
  return weeks;
}

export default async function SellPage() {
  const user = await getSessionUser().catch(() => null);

  if (!user) return <Landing />;

  const [listings, stats, history] = await Promise.all([
    getSellerListings(user.id),
    getSellerStats(user.id, user),
    getSellerTransactionHistory(user.id),
  ]);

  const plain = JSON.parse(
    JSON.stringify({
      user: {
        displayName: user.displayName,
        alias: user.alias,
        sellerStatus: user.sellerStatus,
        sellerCity: user.sellerCity,
      },
      listings,
      stats,
      history,
      weeks: weeklySeries(history),
    }),
  );

  return (
    <div className="page-enter">
      <SellerDesk
        user={plain.user}
        listings={plain.listings}
        stats={plain.stats}
        history={plain.history}
        weeks={plain.weeks}
      />
    </div>
  );
}

function Landing() {
  return (
    <div className="page-enter">
      <section className="mx-auto grid w-full max-w-[94rem] items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-2 lg:px-10">
        <Reveal>
          <p className="eyebrow">Become a seller</p>
          <h1 className="mt-5 font-serif text-[clamp(2.4rem,6vw,4.4rem)] leading-[0.98]">
            Let the right people{" "}
            <span className="serif-italic font-medium">find it</span>.
          </h1>
          <p className="lede mt-6 max-w-xl">
            AUCTA is an auction floor for considered objects. Your seller desk
            walks you through honest photographs, condition, provenance and
            pricing — then the market decides.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sign-in?next=/sell" className="btn btn-primary btn-lg">
              Sign in to your desk <IconArrow size={16} className="arrow" />
            </Link>
            <Link href="/seller-policy" className="btn btn-outline btn-lg">
              Seller standards
            </Link>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="grain overflow-hidden rounded-[var(--radius-xl)] border border-line shadow-[var(--shadow-lift)]">
            <Image
              src="/images/aucta-design-editorial.png"
              alt=""
              width={900}
              height={760}
              sizes="(max-width: 1024px) 92vw, 44vw"
              className="aspect-[7/6] w-full object-cover"
            />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
