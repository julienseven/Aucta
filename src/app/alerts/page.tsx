import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { followedSellers, savedSearches, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AlertsManager } from "@/components/AlertsManager";
import { IconBell } from "@/components/icons";

export const metadata: Metadata = { title: "Alerts", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/sign-in?next=/alerts");

  const [searches, followRows] = await Promise.all([
    db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)),
    db
      .select({ seller: users })
      .from(followedSellers)
      .innerJoin(users, eq(followedSellers.sellerId, users.id))
      .where(eq(followedSellers.userId, user.id)),
  ]);

  const followed = followRows.map(({ seller }) => ({
    id: seller.id,
    alias: seller.alias,
    displayName: seller.displayName,
    sellerCity: seller.sellerCity,
    sellerVerified: seller.sellerVerified,
    metrics: seller.metrics,
  }));

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-12 sm:px-6 lg:px-10">
      <header className="mb-8">
        <p className="eyebrow">Personal</p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3rem)]">
          Alerts &amp;{" "}
          <span className="serif-italic font-medium">followed sellers</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-ink">
          Saved searches watch the catalogue for you; followed sellers notify you
          of new consignments. Manage both here.
        </p>
      </header>

      {searches.length === 0 && followed.length === 0 && (
        <div className="surface mb-6 flex items-center gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-soft text-bronze-deep">
            <IconBell size={22} />
          </span>
          <p className="text-sm text-muted-ink">
            Nothing yet —{" "}
            <Link href="/auctions" className="font-semibold text-espresso underline underline-offset-2">
              browse the auctions
            </Link>
            , filter, and save a search, or follow a verified seller from their
            profile.
          </p>
        </div>
      )}

      <AlertsManager searches={searches} followed={followed} />
    </div>
  );
}
