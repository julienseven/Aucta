"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconHeart } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/components/LanguageProvider";

/* Recognition over recall: the heart always shows its state.
   Success is acknowledged with a tactile pop + toast (peak-end). */
export function WatchButton({
  lotId,
  initialWatching,
  signedIn,
  variant = "card",
  className = "",
}: {
  lotId: string;
  initialWatching: boolean;
  signedIn: boolean;
  variant?: "card" | "panel";
  className?: string;
}) {
  const [watching, setWatching] = useState(initialWatching);
  const [bump, setBump] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const { dict } = useI18n();
  const router = useRouter();

  const label = watching
    ? dict.common.watchRemove
    : dict.common.watchAdd;

  function toggle() {
    if (!signedIn) {
      router.push(
        `/sign-in?next=${encodeURIComponent(
          typeof window !== "undefined" ? window.location.pathname : "/auctions",
        )}`,
      );
      return;
    }
    const next = !watching;
    setWatching(next);
    if (next) {
      setBump(true);
      setTimeout(() => setBump(false), 520);
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/watchlist", {
          method: next ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotId }),
        });
        if (!res.ok) throw new Error();
        toast(
          next ? dict.toast.addedWatch : dict.toast.removedWatch,
          next ? "success" : "info",
        );
        router.refresh();
      } catch {
        setWatching(!next);
        toast(dict.toast.watchError, "error");
      }
    });
  }

  if (variant === "panel") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={watching}
        className={`btn ${watching ? "btn-outline" : "btn-ghost"} ${className}`}
      >
        <IconHeart size={17} className={watching ? "text-oxblood" : ""} />
        <span>{watching ? dict.bid.watching : dict.bid.watch}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={pending}
      aria-label={label}
      title={label}
      aria-pressed={watching}
      className={`watch-heart icon-btn border border-line bg-canvas/90 shadow-sm backdrop-blur-sm hover:bg-canvas ${watching ? "is-on border-oxblood/30" : ""} ${bump ? "bump" : ""} ${className}`}
    >
      <IconHeart size={18} />
    </button>
  );
}
