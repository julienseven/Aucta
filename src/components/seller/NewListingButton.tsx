"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";

export function NewListingButton({ className = "" }: { className?: string }) {
  const { dict } = useI18n();
  const s = dict.seller;
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/seller/listings", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (json?.id) router.push(`/sell/${json.id}`);
  }

  return (
    <button onClick={create} disabled={busy} className={`btn btn-primary ${className}`}>
      {busy ? (
        <>
          <span className="spinner" style={{ width: 15, height: 15 }} />
        </>
      ) : (
        <>+ {s.newListing}</>
      )}
    </button>
  );
}
