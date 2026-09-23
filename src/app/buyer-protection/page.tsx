import type { Metadata } from "next";
import { LegalLayout, Prose } from "@/components/LegalLayout";
import { Reveal } from "@/components/Reveal";
import { getDict } from "@/lib/i18n/server";
import { IconCheck, IconClock, IconShield } from "@/components/icons";

export const metadata: Metadata = { title: "Buyer protection" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dict } = await getDict();
  const b = dict.legal.buyer;

  const pillars = [
    { icon: IconShield, h: b.h1, p: b.p1 },
    { icon: IconClock, h: b.h2, p: b.p2 },
    { icon: IconCheck, h: b.h3, p: b.p3 },
  ];

  return (
    <LegalLayout
      eyebrow={b.eyebrow}
      title={b.title}
      italicWord={b.italic}
      lede={b.lede}
      note={dict.legal.reviewNote}
      relatedLabel={dict.legal.related}
      related={[
        { href: "/auction-rules", label: dict.nav.howBidding },
        { href: "/prohibited-items", label: dict.nav.prohibited },
      ]}
    >
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.h} className="surface-soft p-5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-success-soft text-success">
                <p.icon size={18} />
              </span>
              <h2 className="mt-4 font-serif text-lg">{p.h}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-ink">{p.p}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Prose>
        <p>{b.p4}</p>
        <p>{b.p5}</p>
      </Prose>
    </LegalLayout>
  );
}
