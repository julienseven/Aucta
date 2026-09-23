import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOwnedListing } from "@/lib/seller";
import { ListingWizard, type WizardData } from "@/components/seller/ListingWizard";

export const metadata: Metadata = { title: "Edit listing" };
export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/sign-in?next=/sell");
  const { id } = await params;
  const lot = await getOwnedListing(user.id, id);
  if (!lot) notFound();

  const initial: WizardData = {
    id: lot.id,
    title: lot.title === "Untitled listing" ? "" : lot.title,
    category: lot.category,
    condition: lot.condition,
    description: lot.description,
    flaws: lot.flaws,
    provenance: lot.provenance,
    authenticity: lot.authenticity,
    shippingNotes: lot.shippingNotes,
    images: lot.images.length ? lot.images : [lot.image],
    startAmount: lot.startAmount ? Number(lot.startAmount).toLocaleString("en-ID") : "",
    reserveEnabled: lot.reserveAmount != null,
    reserveAmount: lot.reserveAmount ? Number(lot.reserveAmount).toLocaleString("en-ID") : "",
    shippingCost: Number(lot.shippingCost).toLocaleString("en-ID"),
    startsInHours: 48,
    durationHours: 120,
  };

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-10 sm:px-6 lg:px-10">
      <header className="mb-8">
        <p className="eyebrow">Seller desk</p>
        <h1 className="mt-3 font-serif text-[clamp(1.9rem,4vw,2.8rem)]">
          {lot.stage === "under_review" ? "Listing in review" : "Edit listing"}
        </h1>
        {lot.stage === "rejected" && lot.reviewNote && (
          <div className="mt-4 rounded-xl border border-oxblood/25 bg-oxblood-soft p-4 text-sm text-oxblood">
            <strong>Desk feedback:</strong> {lot.reviewNote}
          </div>
        )}
        {lot.stage === "under_review" && (
          <p className="mt-3 max-w-xl text-sm text-muted-ink">
            This listing is with the desk. Details are locked while it is under
            review; you will be notified of the decision.
          </p>
        )}
      </header>
      {lot.stage === "under_review" ? (
        <div className="surface p-8 text-sm text-muted-ink">
          The desk reviews photographs, condition and whether the object belongs
          on the floor. Typical turnaround is one working day.
        </div>
      ) : (
        <ListingWizard initial={initial} sellerStatus={user.sellerStatus} />
      )}
    </div>
  );
}
