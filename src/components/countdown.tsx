"use client";

import { useEffect, useState } from "react";
import { remainingUntil } from "@/lib/format";
import { useI18n } from "@/components/LanguageProvider";

/* Live time communication. Urgency is real (anti-snipe clock),
   and shown with a calm pulse — never an aggressive one.
   Renders a stable placeholder until mounted to avoid SSR drift. */
export function Countdown({
  endsAt,
  size = "sm",
  light = false,
}: {
  endsAt: string;
  size?: "sm" | "lg";
  light?: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.countdown;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return size === "lg" ? (
      <div
        className={`font-mono text-2xl tabular-nums ${
          light ? "text-canvas/60" : "text-faint"
        }`}
        aria-hidden
      >
        --:--
      </div>
    ) : (
      <span
        className={`font-mono text-xs tabular-nums ${
          light ? "text-canvas/60" : "text-faint"
        }`}
        aria-hidden
      >
        --:--
      </span>
    );
  }

  const r = remainingUntil(endsAt, now);

  if (size === "lg") {
    if (r.ended)
      return (
        <span className={light ? "text-canvas/80" : "text-muted-ink"}>
          {t.closed}
        </span>
      );
    const cells =
      r.days >= 1
        ? [
            { v: r.days, l: t.days },
            { v: r.hours, l: t.hrs },
            { v: r.minutes, l: t.min },
          ]
        : r.hours >= 1
          ? [
              { v: r.hours, l: t.hrs },
              { v: r.minutes, l: t.min },
              { v: r.seconds, l: t.sec },
            ]
          : [
              { v: r.minutes, l: t.min },
              { v: r.seconds, l: t.sec },
            ];
    return (
      <div
        className={`flex items-end gap-2.5 sm:gap-3 ${r.endingSoon ? "text-oxblood" : light ? "text-canvas" : "text-ink"}`}
        aria-live="off"
      >
        {cells.map((c, i) => (
          <div key={c.l} className="flex items-end gap-2.5 sm:gap-3">
            <div className="text-center">
              <div
                className="font-mono tabular-nums leading-none text-3xl sm:text-4xl"
              >
                {String(c.v).padStart(2, "0")}
              </div>
              <div
                className={`mt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${
                  light ? "text-canvas/60" : "text-muted"
                }`}
              >
                {c.l}
              </div>
            </div>
            {i < cells.length - 1 && (
              <span className="pb-5 font-mono text-xl opacity-50">:</span>
            )}
          </div>
        ))}
        {r.endingSoon && <span className="live-dot mb-1.5 ml-1" aria-hidden />}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums ${
        r.ended
          ? light
            ? "text-canvas/60"
            : "text-muted"
          : r.endingSoon
            ? "font-semibold text-oxblood"
            : light
              ? "text-canvas/85"
              : "text-muted-ink"
      }`}
    >
      {r.endingSoon && <span className="live-dot" aria-hidden />}
      {r.ended
        ? t.closed
        : r.days >= 1
          ? `${r.days}d ${r.hours}h ${t.leftShort}`
          : r.hours >= 1
            ? `${r.hours}h ${r.minutes}m ${t.leftShort}`
            : r.minutes >= 1
              ? `${r.minutes}:${String(r.seconds).padStart(2, "0")} ${t.leftShort}`
              : `${r.seconds}s ${t.leftShort}`}
    </span>
  );
}
