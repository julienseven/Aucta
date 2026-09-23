"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconBell, IconClose, IconUsers } from "@/components/icons";
import { categoryIcon } from "@/components/icons";

export type SavedSearch = {
  id: string;
  label: string;
  q: string | null;
  category: string | null;
  condition: string | null;
  min: number | null;
  max: number | null;
  alert: boolean;
};
export type Followed = {
  id: string;
  alias: string;
  displayName: string | null;
  sellerCity: string | null;
  sellerVerified: boolean;
  metrics: unknown;
};

function searchHref(s: SavedSearch): string {
  const params = new URLSearchParams();
  if (s.q) params.set("q", s.q);
  if (s.category) params.set("category", s.category);
  if (s.condition) params.set("condition", s.condition);
  if (s.min) params.set("min", String(s.min));
  if (s.max) params.set("max", String(s.max));
  return `/auctions?${params.toString()}`;
}

export function AlertsManager({
  searches,
  followed,
}: {
  searches: SavedSearch[];
  followed: Followed[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function removeSearch(id: string) {
    setBusy(id);
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function unfollow(sellerId: string) {
    setBusy(sellerId);
    await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, action: "unfollow" }),
    });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="surface p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <IconBell size={18} className="text-bronze-deep" /> Saved searches
        </h2>
        <p className="mt-1 text-xs text-muted">
          We&apos;ll notify you the moment a matching lot appears or opens.
        </p>
        {searches.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            No saved searches yet. Apply filters on the{" "}
            <Link href="/auctions" className="font-semibold text-espresso underline underline-offset-2">
              auctions page
            </Link>{" "}
            and tap <strong>Save search</strong>.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {searches.map((s) => {
              const Icon = s.category
                ? categoryIcon[s.category as keyof typeof categoryIcon] ?? IconBell
                : IconBell;
              return (
                <li
                  key={s.id}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-cream/50 px-4 py-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-soft text-bronze-deep">
                    <Icon size={16} />
                  </span>
                  <Link href={searchHref(s)} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold hover:text-bronze-deep">
                      {s.label}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[s.q, s.condition, s.min ? `min ${s.min}` : null, s.max ? `max ${s.max}` : null]
                        .filter(Boolean)
                        .join(" · ") || "All matching lots"}
                    </p>
                  </Link>
                  <button
                    onClick={() => removeSearch(s.id)}
                    disabled={busy === s.id}
                    aria-label="Remove saved search"
                    className="icon-btn h-8 w-8 hover:text-oxblood"
                  >
                    <IconClose size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="surface p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <IconUsers size={18} className="text-bronze-deep" /> Followed sellers
        </h2>
        <p className="mt-1 text-xs text-muted">
          New consignments from sellers you follow arrive as alerts.
        </p>
        {followed.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            You&apos;re not following any sellers yet. Tap{" "}
            <strong>Follow seller</strong> on a seller&apos;s profile.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {followed.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-cream/50 px-4 py-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-espresso font-serif text-canvas">
                  {f.alias.slice(0, 1)}
                </span>
                <Link href={`/seller/${f.alias}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold hover:text-bronze-deep">
                    {f.displayName ?? f.alias}
                    {f.sellerVerified && (
                      <span className="ml-1.5 badge badge-success !py-0">✓</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">{f.sellerCity ?? "Indonesia"}</p>
                </Link>
                <button
                  onClick={() => unfollow(f.id)}
                  disabled={busy === f.id}
                  className="text-xs font-semibold text-muted hover:text-oxblood"
                >
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
