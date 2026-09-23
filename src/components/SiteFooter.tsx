import Link from "next/link";
import type { Dict } from "@/lib/i18n/dict";
import { LanguageToggle } from "@/components/LanguageToggle";
import { IconHeart, IconSparkle } from "@/components/icons";

export function SiteFooter({ dict }: { dict: Dict }) {
  const explore = [
    { href: "/auctions", label: dict.nav.theAuctions },
    { href: "/sold", label: dict.nav.priceArchive },
    { href: "/sell", label: dict.nav.becomeSeller },
    { href: "/auction-rules", label: dict.nav.howBidding },
  ];

  const trust = [
    { href: "/buyer-protection", label: dict.nav.buyerProtection },
    { href: "/seller-policy", label: dict.nav.sellerStandards },
    { href: "/prohibited-items", label: dict.nav.prohibited },
    { href: "/account", label: dict.nav.account },
  ];

  return (
    <footer className="mt-24 border-t border-line bg-paper-deep">
      <div className="mx-auto w-full max-w-[94rem] px-4 py-16 sm:px-6 lg:px-10">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-serif text-2xl font-bold tracking-[0.16em]">
              AUCTA<sup className="text-xs text-bronze">®</sup>
            </p>
            <p className="mt-4 max-w-xs font-serif text-xl italic leading-snug text-ink-soft">
              {dict.common.tagline}
            </p>
            <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-bronze-deep">
              {dict.common.basedIn}
            </p>
          </div>

          <nav aria-label="Explore">
            <p className="eyebrow is-clean mb-5">{dict.footer.explore}</p>
            <ul className="space-y-3">
              {explore.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-ink transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Trust">
            <p className="eyebrow is-clean mb-5">{dict.footer.trust}</p>
            <ul className="space-y-3">
              {trust.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-ink transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-line pt-7 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-xs text-muted">{dict.footer.rights}</p>
            <div className="flex items-center gap-4 text-xs text-muted-ink">
              <Link href="/privacy" className="hover:text-ink">
                {dict.footer.privacy}
              </Link>
              <Link href="/terms" className="hover:text-ink">
                {dict.footer.terms}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle compact />
            <span className="rounded-full border border-line bg-canvas px-3 py-1.5 font-mono text-[0.7rem] text-muted-ink">
              IDR (Rp)
            </span>
          </div>
        </div>

        <p className="mt-8 inline-flex items-center gap-2 text-[0.72rem] text-faint">
          <IconSparkle size={13} className="text-bronze-soft" />
          {dict.footer.felt}
          <IconHeart size={12} className="text-clay" />
        </p>
      </div>
    </footer>
  );
}
