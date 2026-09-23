import type { Metadata } from "next";
import { LegalLayout, Prose } from "@/components/LegalLayout";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { dict } = await getDict();
  const p = dict.legal.privacy;

  return (
    <LegalLayout
      eyebrow={p.eyebrow}
      title={p.title}
      lede={p.lede}
      note={dict.legal.reviewNote}
      relatedLabel={dict.legal.related}
      related={[
        { href: "/terms", label: dict.footer.terms },
        { href: "/auction-rules", label: dict.nav.howBidding },
      ]}
    >
      <Prose>
        <p>{p.p1}</p>
        <p>{p.p2}</p>
        <p>{p.p3}</p>
        <p>{p.p4}</p>
      </Prose>
    </LegalLayout>
  );
}
