"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { categories } from "@/lib/config";
import type { Dict, Lang } from "@/lib/i18n/dict";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NotificationBell } from "@/components/NotificationBell";
import {
  categoryIcon,
  IconClose,
  IconHeart,
  IconMenu,
  IconUser,
} from "@/components/icons";

type Session = { alias: string; role?: string } | null;

export function SiteHeader({
  session,
  dict,
}: {
  session: Session;
  dict: Dict;
  lang: Lang;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setMenuOpen(false);
      setCatOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <a href="#main" className="skip-link">
        {dict.common.skip}
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-[100] transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled || menuOpen
            ? "border-b border-line bg-paper/92 shadow-[0_8px_30px_-18px_rgba(23,20,15,0.35)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[94rem] items-center gap-3 px-4 sm:px-6 lg:gap-4 lg:px-10">
          <Link
            href="/"
            className="shrink-0 font-serif text-xl font-bold tracking-[0.18em] text-ink"
          >
            AUCTA
            <sup className="text-[0.6rem] text-bronze">®</sup>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-3 hidden items-center gap-6 text-sm font-medium text-ink-soft lg:flex xl:gap-7" aria-label="Primary">
            <Link
              href="/auctions"
              className={`nav-link ${isActive("/auctions") ? "is-active" : ""}`}
            >
              {dict.nav.auctions}
            </Link>
            <div
              className="relative"
              onMouseEnter={() => setCatOpen(true)}
              onMouseLeave={() => setCatOpen(false)}
            >
              <button
                type="button"
                className="nav-link flex items-center gap-1.5"
                aria-expanded={catOpen}
                onClick={() => setCatOpen((v) => !v)}
              >
                {dict.nav.categories}
                <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform duration-200 ${catOpen ? "rotate-180" : ""}`}>
                  <path d="M1 3.5L5 7.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div
                className={`absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-3 transition-all duration-200 ${
                  catOpen
                    ? "visible translate-y-0 opacity-100"
                    : "invisible -translate-y-1 opacity-0"
                }`}
              >
                <div className="surface grid grid-cols-2 gap-1 p-2.5 shadow-[var(--shadow-lift)]">
                  {categories.map((c) => {
                    const Icon = categoryIcon[c.slug];
                    return (
                      <Link
                        key={c.slug}
                        href={`/auctions?category=${c.slug}`}
                        className="group/item flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-soft"
                      >
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-cream text-bronze-deep transition-colors group-hover/item:border-bronze-soft group-hover/item:bg-warm">
                          <Icon size={17} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {c.label}
                          </span>
                          <span className="block text-xs leading-snug text-muted">
                            {dict.home.catBlurbs[
                              c.slug as keyof typeof dict.home.catBlurbs
                            ] ?? c.blurb}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
            <Link href="/sold" className={`nav-link ${pathname === "/sold" ? "is-active" : ""}`}>
              {dict.nav.priceArchive}
            </Link>
            <Link href="/sell" className={`nav-link ${pathname.startsWith("/sell") ? "is-active" : ""}`}>
              {dict.nav.sell}
            </Link>
            {session?.role === "admin" && (
              <Link href="/admin" className={`nav-link ${pathname.startsWith("/admin") ? "is-active" : ""}`}>
                {dict.nav.adminConsole}
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <div className="hidden sm:block">
              <LanguageToggle compact />
            </div>
            {session && (
              <div className="hidden sm:block">
                <NotificationBell />
              </div>
            )}
            <Link
              href="/watchlist"
              aria-label={dict.nav.watchlist}
              className={`icon-btn hidden sm:inline-grid ${pathname === "/watchlist" ? "bg-soft" : ""}`}
            >
              <IconHeart size={19} />
            </Link>
            {session ? (
              <Link href="/account" className="btn btn-outline hidden h-[44px] sm:inline-flex">
                <IconUser size={16} />
                <span className="max-w-[7rem] truncate xl:max-w-[9rem]">{session.alias}</span>
              </Link>
            ) : (
              <Link href="/sign-in" className="btn btn-ghost hidden sm:inline-flex">
                {dict.nav.signIn}
              </Link>
            )}
            <Link
              href={session ? "/auctions" : "/sign-in?next=/sell"}
              className="btn btn-primary hidden md:inline-flex"
            >
              {session ? dict.nav.bidNow : dict.nav.join}
            </Link>
            <button
              type="button"
              className="icon-btn lg:hidden"
              aria-label={dict.header.menu}
              onClick={() => setMenuOpen(true)}
            >
              <IconMenu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button
            type="button"
            aria-label={dict.header.close}
            className="sheet-backdrop absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="sheet-panel absolute inset-x-0 top-0 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-b-3xl border-b border-line bg-paper pb-8 pt-4 shadow-[var(--shadow-lift)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-5">
              <span className="font-serif text-lg font-bold tracking-[0.18em]">
                AUCTA<sup className="text-[0.6rem] text-bronze">®</sup>
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={dict.header.close}
                onClick={() => setMenuOpen(false)}
              >
                <IconClose size={22} />
              </button>
            </div>

            <nav className="mt-4 flex flex-col px-3" aria-label="Mobile">
              {[
                { href: "/auctions", label: dict.nav.theAuctions },
                { href: "/sold", label: dict.nav.priceArchive },
                { href: "/sell", label: dict.nav.sell },
                { href: "/watchlist", label: dict.nav.watchlist },
                { href: "/auction-rules", label: dict.nav.howBidding },
                ...(session?.role === "admin"
                  ? [{ href: "/admin", label: dict.nav.adminConsole }]
                  : []),
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center justify-between rounded-xl px-3 py-3.5 font-serif text-xl text-ink transition-colors hover:bg-soft"
                >
                  {l.label}
                  <span className="font-sans text-bronze">→</span>
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-line px-5 pt-5">
              <p className="eyebrow is-clean mb-3">{dict.nav.categories}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map((c) => {
                  const Icon = categoryIcon[c.slug];
                  return (
                    <Link
                      key={c.slug}
                      href={`/auctions?category=${c.slug}`}
                      className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm font-medium"
                    >
                      <Icon size={16} className="text-bronze-deep" />
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line px-5 pt-5">
              <div className="flex items-center gap-2">
                <LanguageToggle />
                {session && <NotificationBell />}
              </div>
              <span className="rounded-full border border-line bg-canvas px-3 py-1.5 font-mono text-[0.7rem] text-muted-ink">
                IDR (Rp)
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 px-5">
              {session ? (
                <Link href="/account" className="btn btn-primary btn-lg">
                  <IconUser size={17} /> {session.alias}
                </Link>
              ) : (
                <>
                  <Link href="/sign-in" className="btn btn-outline btn-lg">
                    {dict.nav.signIn}
                  </Link>
                  <Link href="/sign-in?next=/sell" className="btn btn-primary btn-lg">
                    {dict.nav.join}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
