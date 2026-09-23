import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/components/LanguageProvider";
import { getDict } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/auth";
import { isLocalDemo } from "@/lib/runtime";

export const metadata: Metadata = {
  title: {
    default: "AUCTA — Rare things. Real prices.",
    template: "%s — AUCTA",
  },
  description:
    "An Indonesian auction house for collectible objects. Discover considered objects, follow the bidding and decide what each one is worth.",
  openGraph: {
    title: "AUCTA — Rare things. Real prices.",
    description:
      "An Indonesian auction house for collectible objects. Transparent proxy bidding, honest condition notes, real prices.",
    locale: "en_ID",
    siteName: "AUCTA",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { lang, dict } = await getDict();
  const user = await getSessionUser().catch(() => null);

  return (
    <html lang={lang}>
      <body>
        <LanguageProvider initialLang={lang}>
          <ToastProvider>
            <SiteHeader
            session={user ? { alias: user.alias, role: user.role } : null}
            dict={dict}
            lang={lang}
          />
            <main id="main" className="pt-16">
              {isLocalDemo() && <p className="bg-paper-deep p-3 text-center text-sm">Development demo — fictional inventory and simulated payments.</p>}
              {children}
            </main>
            <SiteFooter dict={dict} />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
