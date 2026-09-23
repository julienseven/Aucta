import { localDemoEnabled } from "@/lib/auth";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { desc } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Dev inbox",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function DevMailPage() {
  if (!localDemoEnabled()) notFound();

  const items = await db
    .select()
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(60);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="eyebrow">Preview · no SMTP configured</p>
      <h1 className="mt-3 font-serif text-3xl">Development inbox</h1>
      <p className="mt-2 text-sm text-muted-ink">
        Transactional email is written to the <code>email_outbox</code> table
        in preview. With SMTP configured these are delivered normally.
      </p>
      <ul className="mt-8 space-y-3">
        {items.map((m) => (
          <li key={m.id} className="surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{m.subject}</p>
              <span className="font-mono text-[0.66rem] text-faint">
                {m.createdAt.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted">to {m.to}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-cream p-3 font-sans text-xs leading-relaxed text-ink-soft">
              {m.text}
            </pre>
          </li>
        ))}
        {items.length === 0 && (
          <li className="surface p-10 text-center text-sm text-muted-ink">
            No messages yet. Place a bid, get outbid, or complete checkout.
          </li>
        )}
      </ul>
    </div>
  );
}
