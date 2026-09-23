import type { Metadata } from "next";
import { LegalLayout, Prose } from "@/components/LegalLayout";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Terms of use" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dict } = await getDict();
  const p = dict.legal.terms;

  return (
    <LegalLayout
      eyebrow={p.eyebrow}
      title={p.title}
      italicWord={p.italic}
      lede={p.lede}
      note={dict.legal.reviewNote}
      relatedLabel={dict.legal.related}
      related={[
        { href: "/privacy", label: dict.footer.privacy },
        { href: "/auction-rules", label: dict.nav.howBidding },
        { href: "/buyer-protection", label: dict.nav.buyerProtection },
        { href: "/seller-policy", label: dict.nav.sellerStandards },
        { href: "/prohibited-items", label: dict.nav.prohibited },
      ]}
    >
      <Prose>
        <p>{p.p1}</p>
        <p>{p.p2}</p>
        <p>{p.p3}</p>
      </Prose>
    </LegalLayout>
  );
}
