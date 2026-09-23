import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { SignInForm } from "@/components/SignInForm";
import { IconShield } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Use an email link or Google to sign in to AUCTA.",
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, { dict }] = await Promise.all([
    getSessionUser().catch(() => null),
    getDict(),
  ]);
  const { next } = await searchParams;
  if (user) redirect(next ?? "/account");
  const a = dict.auth;

  const points = [a.point1, a.point2, a.point3];

  return (
    <div className="page-enter mx-auto grid w-full max-w-[94rem] min-h-[calc(100vh-4rem)] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_26rem] lg:gap-16 lg:px-10">
      <section className="hidden lg:block">
        <p className="eyebrow">{a.eyebrow}</p>
        <h1 className="mt-5 font-serif text-[clamp(2.6rem,5vw,4.2rem)] leading-[1.02]">
          {a.titleA} <span className="serif-italic font-medium">{a.titleB}</span>.
        </h1>
        <p className="lede mt-6 max-w-md">{a.lede}</p>
        <ul className="mt-9 space-y-4">
          {points.map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-sm text-ink-soft"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                <IconShield size={13} />
              </span>
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-muted">
          {a.newHere}{" "}
          <Link
            href="/auctions"
            className="font-semibold text-espresso underline-offset-4 hover:underline"
          >
            {a.browseFirst}
          </Link>
          .
        </p>
      </section>

      <section className="surface mx-auto w-full max-w-md p-7 shadow-[var(--shadow-card)] sm:p-8">
        <p className="font-serif text-2xl font-semibold">{a.cardTitle}</p>
        <p className="mt-1.5 text-sm text-muted-ink">{a.cardSub}</p>
        <div className="mt-7">
          <SignInForm />
        </div>
      </section>
    </div>
  );
}
