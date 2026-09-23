import type { Metadata } from "next";
import { LegalLayout, Prose } from "@/components/LegalLayout";
import { Reveal } from "@/components/Reveal";
import { getDict } from "@/lib/i18n/server";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Seller standards" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dict } = await getDict();
  const s = dict.legal.seller;

  return (
    <LegalLayout
      eyebrow={s.eyebrow}
      title={s.title}
      italicWord={s.italic}
      lede={s.lede}
      note={dict.legal.reviewNote}
      relatedLabel={dict.legal.related}
      related={[
        { href: "/prohibited-items", label: dict.nav.prohibited },
        { href: "/auction-rules", label: dict.nav.howBidding },
        { href: "/sell", label: dict.nav.becomeSeller },
      ]}
    >
      <Prose>
        <p>{s.p1}</p>
        <p>{s.p2}</p>
      </Prose>

      <Reveal>
        <div className="surface grid gap-5 p-6 sm:grid-cols-2">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
              {s.commissionLabel}
            </p>
            <p className="mt-2 font-serif text-4xl text-bronze-deep">
              {config.sellerCommissionBps / 100}%
            </p>
            <p className="mt-1 text-xs text-muted">
              {s.commissionOf} {config.sellerCommissionBps}.
            </p>
          </div>
          <div className="text-sm leading-relaxed text-muted-ink">{s.payout}</div>
        </div>
      </Reveal>

      <Prose>
        <p>{s.closing}</p>
      </Prose>
    </LegalLayout>
  );
}
