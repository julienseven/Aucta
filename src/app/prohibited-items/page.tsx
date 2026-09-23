import type { Metadata } from "next";
import { LegalLayout, Prose } from "@/components/LegalLayout";
import { Reveal } from "@/components/Reveal";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Prohibited items" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dict } = await getDict();
  const p = dict.legal.prohibited;

  return (
    <LegalLayout
      eyebrow={p.eyebrow}
      title={p.title}
      italicWord={p.italic}
      lede={p.lede}
      note={dict.legal.reviewNote}
      relatedLabel={dict.legal.related}
      related={[
        { href: "/seller-policy", label: dict.nav.sellerStandards },
        { href: "/terms", label: dict.footer.terms },
      ]}
    >
      <Prose>
        <p>{p.incomplete}</p>
      </Prose>

      <Reveal>
        <ul className="surface overflow-hidden">
          {p.items.map((item, i) => (
            <li
              key={item}
              className={`flex items-start gap-3 px-5 py-3.5 text-sm ${
                i !== p.items.length - 1 ? "border-b border-line-soft" : ""
              }`}
            >
              <span
                aria-hidden
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-oxblood-soft text-xs font-bold text-oxblood"
              >
                ✕
              </span>
              <span className="text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Prose>
        <p>{p.closing}</p>
      </Prose>
    </LegalLayout>
  );
}
