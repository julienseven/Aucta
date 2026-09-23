import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { VerificationForm } from "@/components/seller/VerificationForm";
import { Reveal } from "@/components/Reveal";
import { IconCheck, IconClock, IconShieldCheck } from "@/components/icons";

export const metadata: Metadata = { title: "Seller verification" };
export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect("/sign-in?next=/sell/verification");

  const status = user.sellerStatus;

  return (
    <div className="page-enter mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Reveal>
        <p className="eyebrow">Seller desk</p>
        <h1 className="mt-4 font-serif text-[clamp(2rem,4vw,3rem)]">
          Seller <span className="serif-italic font-medium">verification</span>
        </h1>
      </Reveal>

      <Reveal delay={120} className="mt-8">
        {status === "verified" ? (
          <div className="surface flex flex-col items-center gap-4 p-10 text-center">
            <span className="toast-check grid h-14 w-14 place-items-center rounded-full bg-success text-white">
              <IconCheck size={26} />
            </span>
            <h2 className="font-serif text-2xl">Identity verified</h2>
            <p className="max-w-md text-sm text-muted-ink">
              Listings you submit go directly to the approval queue. The badge
              appears on your seller profile and every consigned lot.
            </p>
            <Link href="/sell" className="btn btn-primary btn-lg mt-2">
              Open your desk
            </Link>
          </div>
        ) : status === "pending" ? (
          <div className="surface flex flex-col items-center gap-4 p-10 text-center">
            <span className="grid h-14 w-14 animate-pulse place-items-center rounded-full bg-amber-soft text-amber">
              <IconClock size={26} />
            </span>
            <h2 className="font-serif text-2xl">Application with the desk</h2>
            <p className="max-w-md text-sm text-muted-ink">
              Most identity checks are answered within one working day. You can
              prepare drafts while you wait.
            </p>
            <Link href="/sell" className="btn btn-outline btn-lg mt-2">
              Prepare drafts
            </Link>
          </div>
        ) : (
          <>
            {status === "rejected" && (
              <p className="mb-4 rounded-xl border border-oxblood/25 bg-oxblood-soft px-4 py-3 text-sm text-oxblood">
                The desk requested more information before verifying you. Please
                resubmit with a clear document number and statement.
              </p>
            )}
            <VerificationForm />
          </>
        )}
      </Reveal>

      <Reveal delay={200}>
        <div className="mt-6 flex items-start gap-3 text-xs leading-relaxed text-muted">
          <IconShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
          <p>
            Verification is recorded on your profile by AUCTA — it is never a
            badge you assign yourself. A verified seller photographs the object
            they hold, names obvious flaws, and ships the same object after a
            paid win.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
