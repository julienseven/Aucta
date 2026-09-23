import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ListingWizard, type WizardData } from "@/components/seller/ListingWizard";

export const metadata: Metadata = { title: "Start listing" };
export const dynamic = "force-dynamic";

const blank: WizardData = {
  title: "",
  category: "watches",
  condition: "Good",
  description: "",
  flaws: "",
  provenance: "",
  authenticity: "",
  shippingNotes: "",
  images: [],
  startAmount: "",
  reserveEnabled: false,
  reserveAmount: "",
  shippingCost: "0",
  startsInHours: 48,
  durationHours: 120,
};

export default async function NewListingPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/sign-in?next=/sell/new");
  if (user.suspended) redirect("/sell");

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-10 sm:px-6 lg:px-10">
      <header className="mb-8">
        <p className="eyebrow">Seller desk</p>
        <h1 className="mt-3 font-serif text-[clamp(1.9rem,4vw,2.8rem)]">
          Create a <span className="serif-italic font-medium">listing</span>
        </h1>
      </header>
      <ListingWizard initial={blank} sellerStatus={user.sellerStatus} />
    </div>
  );
}
