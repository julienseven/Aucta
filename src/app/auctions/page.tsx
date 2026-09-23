import type { Metadata } from "next";
import { CatalogueSection } from "@/components/catalogue/CatalogueSection";
import { Reveal } from "@/components/Reveal";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Auctions",
  description:
    "Live, upcoming and recently decided lots. Watches, cameras, cards, sneakers, design, gaming and more.",
};

export const dynamic = "force-dynamic";

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { dict } = await getDict();

  return (
    <div className="page-enter">
      <section className="mx-auto w-full max-w-[94rem] px-4 pb-4 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        <Reveal>
          <p className="eyebrow">{dict.cata.eyebrow}</p>
          <h1 className="mt-4 font-serif text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[0.98]">
            {dict.cata.title}
          </h1>
          <p className="lede mt-5 max-w-2xl">{dict.cata.lede}</p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-[94rem] px-4 py-6 sm:px-6 lg:px-10">
        <CatalogueSection searchParams={sp} mode="open" />
      </section>
    </div>
  );
}
