"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { categories, conditions } from "@/lib/config";
import type { LotRow } from "@/db/schema";
import type { Dict } from "@/lib/i18n/dict";
import { LotCard } from "@/components/LotCard";
import { SaveSearchButton } from "@/components/SaveSearchButton";
import {
  IconClose,
  IconSearch,
  IconSliders,
  categoryIcon,
} from "@/components/icons";

type Params = {
  status?: string;
  category?: string;
  q?: string;
  condition?: string;
  min?: string;
  max?: string;
  sort?: string;
};

const sortValues = ["ending", "newest", "watched", "price-asc", "price-desc"];
const idSortLabels: Record<string, string> = {
  ending: "Segera berakhir",
  newest: "Terbaru",
  watched: "Terbanyak dipantau",
  "price-asc": "Harga, rendah ke tinggi",
  "price-desc": "Harga, tinggi ke rendah",
};
const enSortLabels: Record<string, string> = {
  ending: "Ending soon",
  newest: "Newest",
  watched: "Most watched",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
};

export function CatalogueClient({
  initialLots,
  watchIds,
  signedIn,
  params,
  dict,
  mode = "open",
}: {
  initialLots: LotRow[];
  watchIds: string[];
  signedIn: boolean;
  params: Params;
  dict: Dict;
  mode?: "open" | "sold";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(params.q ?? "");
  const [minDraft, setMinDraft] = useState(params.min ?? "");
  const [maxDraft, setMaxDraft] = useState(params.max ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lots = initialLots;

  const statusTabs = [
    { value: "open", label: dict.cata.tabOpen },
    { value: "live", label: dict.common.live },
    { value: "upcoming", label: dict.common.upcoming },
    { value: "sold", label: dict.common.sold },
  ];

  const isId = dict.cata.title === "Lelang";
  const sortLabels = isId ? idSortLabels : enSortLabels;

  const buildHref = (next: Record<string, string | undefined>) => {
    const merged = { ...params, ...next };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) u.set(k, v);
    }
    const qs = u.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };

  const navigate = (next: Record<string, string | undefined>) => {
    const href = buildHref(next);
    startTransition(() => router.push(href, { scroll: false }));
  };

  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value || undefined }), 380);
  }

  function applyPrice(e?: React.FormEvent) {
    e?.preventDefault();
    navigate({
      min: minDraft || undefined,
      max: maxDraft || undefined,
    });
  }

  function clearAll() {
    setSearch("");
    setMinDraft("");
    setMaxDraft("");
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const activeStatus = params.status ?? "open";
  const activeChips: { key: string; label: string; next: Record<string, string | undefined> }[] = [];
  if (params.category)
    activeChips.push({
      key: "category",
      label: categories.find((c) => c.slug === params.category)?.label ?? params.category,
      next: { category: undefined },
    });
  if (params.condition)
    activeChips.push({
      key: "condition",
      label: params.condition,
      next: { condition: undefined },
    });
  if (params.q)
    activeChips.push({
      key: "q",
      label: `“${params.q}”`,
      next: { q: undefined },
    });
  if (params.min)
    activeChips.push({
      key: "min",
      label: `Min Rp ${Number(params.min).toLocaleString("en-ID")}`,
      next: { min: undefined },
    });
  if (params.max)
    activeChips.push({
      key: "max",
      label: `Max Rp ${Number(params.max).toLocaleString("en-ID")}`,
      next: { max: undefined },
    });

  const hasFilters =
    activeChips.length > 0 || (params.status && params.status !== "open");

  return (
    <div>
      {/* Status tabs */}
      {mode === "open" && (
        <div
          role="tablist"
          aria-label={dict.common.status}
          className="flex flex-wrap items-center gap-1 rounded-3xl border border-line bg-canvas p-1.5"
        >
          {statusTabs.map((t) => (
            <Link
              key={t.value}
              role="tab"
              aria-selected={activeStatus === t.value}
              href={buildHref({ status: t.value === "open" ? undefined : t.value })}
              onClick={(e) => {
                e.preventDefault();
                navigate({ status: t.value === "open" ? undefined : t.value });
              }}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 sm:px-4 sm:text-sm ${
                activeStatus === t.value
                  ? "bg-ink text-canvas shadow-sm"
                  : "text-muted-ink hover:bg-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <IconSearch
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={dict.cata.searchPlaceholder}
            aria-label={dict.common.search}
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`btn ${filtersOpen ? "btn-primary" : "btn-outline"}`}
          >
            <IconSliders size={16} />
            <span className="hidden sm:inline">{dict.common.refine}</span>
            {activeChips.length > 0 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-bronze text-[0.65rem] font-bold text-white">
                {activeChips.length}
              </span>
            )}
          </button>
          <SaveSearchButton />
          <div className="select-wrap">
            <select
              aria-label={dict.common.sort}
              className="input appearance-none pr-9"
              value={params.sort ?? "ending"}
              onChange={(e) =>
                navigate({ sort: e.target.value === "ending" ? undefined : e.target.value })
              }
            >
              {sortValues.map((v) => (
                <option key={v} value={v}>
                  {sortLabels[v]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Category chips — recognition over recall */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={buildHref({ category: undefined })}
          className={`chip shrink-0 ${!params.category ? "is-active" : ""}`}
        >
          {dict.common.allCategories}
        </Link>
        {categories.map((c) => {
          const Icon = categoryIcon[c.slug];
          return (
            <Link
              key={c.slug}
              href={buildHref({ category: c.slug })}
              onClick={(e) => {
                e.preventDefault();
                navigate({ category: params.category === c.slug ? undefined : c.slug });
              }}
              className={`chip shrink-0 ${params.category === c.slug ? "is-active" : ""}`}
            >
              <Icon size={15} />
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Progressive disclosure: advanced filters (Hick's Law) */}
      <div
        className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          filtersOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <form
            onSubmit={applyPrice}
            className="surface-soft grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
                  {dict.common.condition}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={params.condition === c}
                      onClick={() =>
                        navigate({
                          condition: params.condition === c ? undefined : c,
                        })
                      }
                      className={`chip ${params.condition === c ? "is-active" : ""}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">
                  {dict.common.priceRange}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    placeholder={dict.common.min}
                    aria-label={dict.common.min}
                    value={minDraft}
                    onChange={(e) => setMinDraft(e.target.value.replace(/[^\d]/g, ""))}
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    placeholder={dict.common.max}
                    aria-label={dict.common.max}
                    value={maxDraft}
                    onChange={(e) => setMaxDraft(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                {dict.common.apply}
              </button>
              <button type="button" onClick={clearAll} className="btn btn-ghost">
                {dict.common.clear}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Active filter state */}
      <div className="mt-4 flex min-h-8 flex-wrap items-center gap-2 text-sm text-muted">
        {hasFilters ? (
          <>
            <span className="font-semibold text-ink">{lots.length}</span>
            <span>
              {lots.length === 1 ? dict.common.lot : dict.common.lots} ·
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => navigate(chip.next)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-3 pr-2 text-xs font-medium text-ink-soft transition-colors hover:border-oxblood/40 hover:bg-oxblood-soft hover:text-oxblood"
              >
                {chip.label}
                <IconClose size={12} />
              </button>
            ))}
          </>
        ) : (
          <span>{dict.common.noFilters}</span>
        )}
      </div>

      {/* Results */}
      <div className="relative mt-2" aria-busy={pending}>
        {pending && <CatalogueOverlay label={dict.cata.refreshing} />}
        {lots.length === 0 ? (
          <EmptyState mode={mode} onClear={clearAll} dict={dict} />
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {lots.map((lot, i) => (
              <div
                key={lot.id}
                className="page-enter h-full"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                <LotCard
                  lot={lot}
                  watching={watchIds.includes(lot.id)}
                  signedIn={signedIn}
                  dict={dict}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogueOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-card bg-paper/60 backdrop-blur-[2px]">
      <span className="flex items-center gap-3 text-sm font-medium text-bronze-deep">
        <span className="spinner" aria-hidden />
        {label}
      </span>
    </div>
  );
}

function EmptyState({
  mode,
  onClear,
  dict,
}: {
  mode: "open" | "sold";
  onClear: () => void;
  dict: Dict;
}) {
  return (
    <div className="surface flex flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-soft text-bronze-deep">
        <IconSearch size={24} />
      </span>
      <div>
        <h3 className="font-serif text-2xl">
          {mode === "sold" ? dict.cata.emptySoldTitle : dict.cata.emptyOpenTitle}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-ink">
          {mode === "sold" ? dict.cata.emptySoldBody : dict.cata.emptyOpenBody}
        </p>
      </div>
      <button onClick={onClear} className="btn btn-outline">
        {dict.cata.clearAll}
      </button>
    </div>
  );
}
