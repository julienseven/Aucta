"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/LanguageProvider";
import { useToast } from "@/components/Toast";
import { IconBell } from "@/components/icons";

export function SaveSearchButton() {
  const { dict } = useI18n();
  const { toast } = useToast();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Only offer alerts for meaningful filters (not the default status tab).
  const hasCriteria =
    !!params.get("q") ||
    !!params.get("category") ||
    !!params.get("condition") ||
    !!params.get("min") ||
    !!params.get("max");

  if (!hasCriteria) return null;

  async function save() {
    setBusy(true);
    const body = {
      q: params.get("q") || null,
      category: params.get("category") || null,
      condition: params.get("condition") || null,
      min: params.get("min") ? Number(params.get("min")) : null,
      max: params.get("max") ? Number(params.get("max")) : null,
      label: "",
      alert: true,
    };
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      toast(pathname.startsWith("/sold") ? "Archive alert saved" : "Search alert saved", "success");
    } else if (res.status === 401) {
      window.location.href =
        "/sign-in?next=" + encodeURIComponent(pathname + "?" + params.toString());
    } else {
      toast("Could not save this search", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={busy || saved}
      className="btn btn-outline"
      title="Get notified when a matching lot appears"
    >
      <IconBell size={15} />
      <span className="hidden sm:inline">
        {saved ? "Alert on" : "Save search"}
      </span>
    </button>
  );
}
