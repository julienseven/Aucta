"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, type ComponentType, type ReactNode, type SVGProps } from "react";
import { useI18n } from "@/components/LanguageProvider";

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/* ----------------------------- Sparkline ----------------------------- */
export function Sparkline({
  points,
  className = "",
  stroke = "currentColor",
  fill = true,
}: {
  points: number[];
  className?: string;
  stroke?: string;
  fill?: boolean;
}) {
  const w = 120;
  const h = 36;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = h - 3 - ((p - min) / range) * (h - 8);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const gid = useId();
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------- Donut ------------------------------- */
export function Donut({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: ReactNode;
  centerSub?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offsets = segments.map((_, i) =>
    segments.slice(0, i).reduce((sum, segment) => sum + (segment.value / total) * c, 0),
  );
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-soft)" strokeWidth="16" />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offsets[i]}
              strokeLinecap="butt"
            />
          );
          return el;
        })}
      </svg>
      <div className="relative -ml-[7.6rem] mr-auto hidden place-items-center sm:grid">
        <div className="text-center">
          <div className="font-serif text-2xl leading-none">{centerLabel}</div>
          {centerSub && (
            <div className="mt-1 text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              {centerSub}
            </div>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-ink">{s.label}</span>
            <span className="font-mono font-semibold tabular-nums">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- Bars ------------------------------- */
export function Bars({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {data.map((d, i) => (
          <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="relative w-full">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-bronze-deep to-bronze-soft transition-all duration-500 group-hover:from-espresso group-hover:to-bronze"
                style={{
                  height: `${Math.max((d.value / max) * 8.5, 0.3)}rem`,
                  transitionDelay: `${i * 40}ms`,
                }}
              >
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 font-mono text-[0.6rem] text-canvas opacity-0 transition-opacity group-hover:opacity-100">
                  {format ? format(d.value) : d.value}
                </span>
              </div>
            </div>
            <span className="text-[0.62rem] text-muted">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ KPI card ----------------------------- */
export function KpiCard({
  label,
  value,
  delta,
  deltaPositive = true,
  deltaLabel,
  spark,
  icon: Icon,
  tone = "bronze",
  action,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaPositive?: boolean;
  deltaLabel?: string;
  spark?: number[];
  icon?: IconType;
  tone?: "bronze" | "red" | "green" | "ink";
  action?: ReactNode;
}) {
  const tones: Record<string, string> = {
    bronze: "bg-amber-soft text-bronze-deep",
    red: "bg-oxblood-soft text-oxblood",
    green: "bg-success-soft text-success",
    ink: "bg-soft text-ink",
  };
  return (
    <div className="surface relative flex flex-col gap-3 p-5 transition-shadow duration-300 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted">
          {label}
        </p>
        {Icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-full ${tones[tone]}`}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="font-serif text-3xl leading-none tabular-nums">{value}</div>
      {delta && (
        <p
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            deltaPositive ? "text-success" : "text-oxblood"
          }`}
        >
          <span>{deltaPositive ? "▲" : "▼"}</span>
          {delta}
          {deltaLabel && (
            <span className="font-normal text-muted">{deltaLabel}</span>
          )}
        </p>
      )}
      {spark && (
        <Sparkline
          points={spark}
          className="mt-1 h-9 w-full text-bronze"
          stroke="var(--color-bronze)"
        />
      )}
      {action}
    </div>
  );
}

/* ------------------------- Dashboard shell --------------------------- */
export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  count?: number;
  tone?: "red" | "bronze";
};

export function DashboardShell({
  nav,
  brand,
  brandHref = "/sell",
  children,
  aside,
  active,
  onNavigate,
}: {
  nav: NavItem[];
  brand: ReactNode;
  brandHref?: string;
  children: ReactNode;
  aside?: ReactNode;
  active?: string;
  onNavigate?: (key: string) => void;
}) {
  const pathname = usePathname();
  return (
    <div className="mx-auto w-full max-w-[94rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      {/* Mobile nav rail */}
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Dashboard">
        {nav.map((item) => {
          const isHash = item.href.startsWith("#");
          const isActive = isHash ? active === item.href.slice(1) : item.href === brandHref ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          const cls = `flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
            isActive ? "border-ink bg-ink text-canvas" : "border-line bg-canvas text-muted-ink"
          }`;
          const inner = (
            <>
              <Icon size={15} />
              {item.label}
              {item.count != null && item.count > 0 && (
                <span
                  className={`grid min-w-[1.1rem] place-items-center rounded-full px-1 text-[0.62rem] font-bold ${
                    item.tone === "red"
                      ? "h-4 bg-oxblood text-white"
                      : isActive
                        ? "h-4 bg-canvas/20 text-canvas"
                        : "h-4 bg-soft text-muted-ink"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </>
          );
          return isHash ? (
            <button key={item.href} type="button" onClick={() => onNavigate?.(item.href.slice(1))} className={cls}>
              {inner}
            </button>
          ) : (
            <Link key={item.href} href={item.href} className={cls}>
              {inner}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[15.5rem_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Link href={brandHref} className="block">
              {brand}
            </Link>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Dashboard">
              {nav.map((item) => {
                const isHash = item.href.startsWith("#");
                const isActive = isHash
                  ? active === item.href.slice(1)
                  : item.href === brandHref
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                const cls = `group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-ink text-canvas shadow-sm"
                    : "text-muted-ink hover:bg-soft hover:text-ink"
                }`;
                const inner = (
                  <>
                    <Icon size={17} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count != null && item.count > 0 && (
                      <span
                        className={`grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1.5 text-[0.64rem] font-bold ${
                          item.tone === "red"
                            ? "bg-oxblood text-white"
                            : isActive
                              ? "bg-canvas/20 text-canvas"
                              : "bg-soft text-muted-ink"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </>
                );
                return isHash ? (
                  <button key={item.href} type="button" onClick={() => onNavigate?.(item.href.slice(1))} className={cls}>
                    {inner}
                  </button>
                ) : (
                  <Link key={item.href} href={item.href} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </nav>
            {aside}
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------- Listing stage badge ----------------------- */
export function ListingStageBadge({
  stage,
  status,
}: {
  stage: string;
  status: string;
}) {
  const { dict } = useI18n();
  const s = dict.seller;
  const map: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    draft: { label: s.stageDraft, cls: "badge-muted" },
    under_review: { label: s.stageUnderReview, cls: "badge-upcoming" },
    approved: { label: s.stageApproved, cls: "badge-success" },
    published:
      status === "live"
        ? { label: dict.common.live, cls: "badge-live", pulse: true }
        : { label: s.stageApproved, cls: "badge-success" },
    rejected: { label: s.stageRejected, cls: "badge" },
    paused: { label: s.stagePaused, cls: "badge-sold" },
    withdrawn: { label: s.stageWithdrawn, cls: "badge-sold" },
    house:
      status === "sold"
        ? { label: s.stageSold, cls: "badge-sold" }
        : { label: s.stagePublished, cls: "badge-success" },
  };
  const meta =
    map[stage] ??
    (status === "sold"
      ? { label: s.stageSold, cls: "badge-sold" }
      : { label: stage, cls: "badge-muted" });
  return (
    <span className={`badge ${meta.cls}`}>
      {meta.pulse && <span className="live-dot" />}
      {meta.label}
    </span>
  );
}

/* --------------------------- Empty queue ----------------------------- */
export function EmptyQueue({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  const { dict } = useI18n();
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-soft text-bronze-deep">
        <Icon size={22} />
      </span>
      <p className="max-w-sm text-sm text-muted-ink">{children ?? dict.admin.noQueue}</p>
    </div>
  );
}
