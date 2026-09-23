import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import { IconShield } from "@/components/icons";

export type RelatedLink = { href: string; label: string };

export function LegalLayout({
  eyebrow,
  title,
  italicWord,
  lede,
  note,
  relatedLabel,
  children,
  related,
}: {
  eyebrow: string;
  title: string;
  italicWord?: string;
  lede?: string;
  note: string;
  relatedLabel: string;
  children: ReactNode;
  related?: RelatedLink[];
}) {
  return (
    <div className="page-enter">
      <section className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 lg:pt-14">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02]">
            {title}{" "}
            {italicWord && (
              <span className="serif-italic font-medium">{italicWord}</span>
            )}
          </h1>
          {lede && <p className="lede mt-5">{lede}</p>}
        </Reveal>

        <Reveal delay={120}>
          <aside
            role="note"
            className="mt-8 flex items-start gap-3 rounded-xl border border-amber/30 bg-amber-soft px-5 py-4 text-xs leading-relaxed text-amber"
          >
            <IconShield size={17} className="mt-0.5 shrink-0" />
            <span>{note}</span>
          </aside>
        </Reveal>
      </section>

      <section className="mx-auto mt-10 w-full max-w-3xl space-y-5 px-4 sm:px-6">
        {children}
      </section>

      {related && related.length > 0 && (
        <section className="mx-auto mt-14 w-full max-w-3xl px-4 sm:px-6">
          <div className="surface-soft flex flex-wrap items-center gap-x-2 gap-y-2 p-5 text-sm">
            <span className="mr-1 font-semibold">{relatedLabel}</span>
            {related.map((l, i) => (
              <span key={l.href} className="flex items-center gap-2">
                {i > 0 && <span className="text-line">·</span>}
                <Link
                  href={l.href}
                  className="font-medium text-espresso underline-offset-4 hover:underline"
                >
                  {l.label}
                </Link>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <Reveal>
      <div className="space-y-4 text-[0.95rem] leading-[1.8] text-ink-soft">
        {children}
      </div>
    </Reveal>
  );
}
