import type { Metadata } from "next";
import { LegalLayout, Prose } from "@/components/LegalLayout";
import { Reveal } from "@/components/Reveal";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "How bidding works" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dict } = await getDict();
  const r = dict.legal.rules;

  const increments = [
    { under: `${r.under} Rp 1.000.000`, step: "Rp 25.000" },
    { under: `${r.under} Rp 5.000.000`, step: "Rp 50.000" },
    { under: `${r.under} Rp 20.000.000`, step: "Rp 100.000" },
    { under: `Rp 20.000.000 ${r.andAbove}`, step: "Rp 250.000" },
  ];

  const rules = [
    { h: r.h1, p: r.p1 },
    { h: r.h2, p: r.p2 },
    { h: r.h3, p: r.p3 },
    { h: r.h4, p: r.p4 },
  ];

  return (
    <LegalLayout
      eyebrow={r.eyebrow}
      title={r.title}
      italicWord={r.italic}
      lede={r.lede}
      note={dict.legal.reviewNote}
      relatedLabel={dict.legal.related}
      related={[
        { href: "/buyer-protection", label: dict.nav.buyerProtection },
        { href: "/seller-policy", label: dict.nav.sellerStandards },
        { href: "/prohibited-items", label: dict.nav.prohibited },
      ]}
    >
      <Reveal>
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <div
              key={rule.h}
              className="surface flex gap-4 p-5 transition-transform duration-300 hover:translate-x-1"
            >
              <span className="medallion medallion-outline shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="font-serif text-lg">{rule.h}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-ink">
                  {rule.p}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <div className="surface overflow-hidden">
          <p className="border-b border-line px-5 py-3.5 font-semibold">
            {r.increments}
          </p>
          <p className="px-5 pt-3 text-xs text-muted">{r.incrementsNote}</p>
          <dl className="mt-2">
            {increments.map((inc, i) => (
              <div
                key={inc.under}
                className={`grid grid-cols-[1fr_auto] gap-4 px-5 py-3 text-sm ${
                  i !== increments.length - 1 ? "border-b border-line-soft" : ""
                }`}
              >
                <dt className="text-muted-ink">{inc.under}</dt>
                <dd className="font-mono font-semibold tabular-nums">{inc.step}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>

      <Prose>
        <p>{r.closing}</p>
      </Prose>
    </LegalLayout>
  );
}
