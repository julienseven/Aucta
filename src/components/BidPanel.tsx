"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatRupiah, parseRupiahInput, remainingUntil } from "@/lib/format";
import { incrementFor } from "@/lib/config";
import type { Dict } from "@/lib/i18n/dict";
import { Countdown } from "@/components/Countdown";
import { WatchButton } from "@/components/WatchButton";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconClose,
  IconShield,
  IconTarget,
  IconClock,
  IconArrow,
} from "@/components/icons";

type HistoryItem = {
  id: number;
  alias: string;
  createdAt: string;
};

export function BidPanel({
  lot,
  signedIn,
  watching,
  history,
  dict,
}: {
  lot: {
    id: string;
    slug: string;
    status: string;
    startAmount: number;
    currentAmount: number;
    hasReserve: boolean;
    reserveMet: boolean;
    leadingAlias: string | null;
    bidCount: number;
    watchCount: number;
    endsAt: string;
    startsAt: string;
    incrementOverride: number | null;
  };
  signedIn: boolean;
  watching: boolean;
  history: HistoryItem[];
  dict: Dict;
}) {
  const b = dict.bid;
  const router = useRouter();
  const { toast } = useToast();
  void history;

  const start = Number(lot.startAmount);
  const [current, setCurrent] = useState(Number(lot.currentAmount));
  const [bidCount, setBidCount] = useState(lot.bidCount);
  const [leader, setLeader] = useState<string | null>(lot.leadingAlias);
  const [endsAt, setEndsAt] = useState(lot.endsAt);
  const [rawMax, setRawMax] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amount: number;
    extended: boolean;
    leading: boolean;
  } | null>(null);

  const increment = lot.incrementOverride ?? incrementFor(current);
  const nextMin = bidCount === 0 ? start : current + increment;
  const [reserveMet, setReserveMet] = useState(lot.reserveMet);
  const timeLeft = remainingUntil(endsAt);
  const isLive = lot.status === "live" && !timeLeft.ended;

  const maxAmount = parseRupiahInput(rawMax);
  const quickOptions = useMemo(
    () => [
      nextMin,
      nextMin + increment * 2,
      Math.ceil((nextMin + increment * 5) / increment) * increment,
    ],
    [nextMin, increment],
  );

  async function submitBid() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId: lot.id, amount: maxAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        const codeMap: Record<string, string> = {
          NOT_FOUND: b.errNotFound,
          NOT_OPEN: b.errNotOpen,
          CLOSED: b.errClosed,
          NOT_WHOLE: b.errWhole,
          DECIMALS: b.errDecimals,
          GENERIC: b.errGeneric,
        };
        let message: string | undefined = data?.code
          ? codeMap[data.code]
          : undefined;
        if (data?.code === "TOO_LOW" && data.amount != null)
          message = b.errTooLow.replace("{amount}", formatRupiah(data.amount));
        if (data?.code === "RAISE_LOW" && data.amount != null)
          message = b.errRaise.replace("{amount}", formatRupiah(data.amount));
        setError(message ?? data?.error ?? b.errGeneric);
        setReviewing(false);
        return;
      }
      setCurrent(data.current);
      setReserveMet(data.reserveMet);
      setBidCount(data.bidCount ?? bidCount);
      setLeader(data.leadingAlias ?? leader);
      if (data.endsAt) setEndsAt(data.endsAt);
      setSuccess({
        amount: maxAmount,
        extended: Boolean(data.extended),
        leading: data.leading,
      });
      setReviewing(false);
      setRawMax("");
      toast(
        data.leading ? dict.toast.bidLead : dict.toast.bidIn,
        "success",
      );
      router.refresh();
    } catch {
      setError(b.errGeneric);
      setReviewing(false);
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------- UPCOMING ------------------------- */
  if (lot.status === "upcoming") {
    return (
      <div
        id="bid-panel"
        className="surface space-y-5 p-5 sm:p-6 md:sticky md:top-24"
      >
        <span className="badge badge-upcoming">{dict.common.upcoming}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {b.opensBody}
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {formatRupiah(start)}
          </p>
        </div>
        <div className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
          <IconClock size={15} className="mr-1.5 inline" />
          {b.opensAt}{" "}
          {new Date(lot.startsAt).toLocaleString(undefined, {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </div>
        <WatchButton
          lotId={lot.id}
          initialWatching={watching}
          signedIn={signedIn}
          variant="panel"
          className="btn-block"
        />
        <ProxyNote b={b} />
      </div>
    );
  }

  /* --------------------------- SOLD --------------------------- */
  if (lot.status === "sold" || !isLive) {
    return (
      <div className="surface static space-y-5 p-6 md:sticky md:top-24">
        <span className="badge badge-sold">{dict.common.closed}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {dict.common.hammerPrice}
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {formatRupiah(Number(lot.currentAmount))}
          </p>
        </div>
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{b.bidsPlaced}</dt>
            <dd className="font-semibold">{bidCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{dict.common.watchers}</dt>
            <dd className="font-semibold">{lot.watchCount}</dd>
          </div>
        </dl>
        <Link href="/sold" className="btn btn-outline btn-block">
          {b.archiveCta}
        </Link>
      </div>
    );
  }

  /* ---------------------------- LIVE -------------------------- */
  return (
    <>
      <div
        id="bid-panel"
        className="surface static space-y-5 p-5 sm:p-6 md:sticky md:top-24"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="badge badge-live">
            <span className="live-dot" /> {dict.common.live}
          </span>
          <Countdown endsAt={endsAt} />
        </div>

        {/* Big timer (visual hierarchy: the clock is the focus) */}
        <div className="rounded-xl border border-line bg-cream px-4 py-4">
          <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">
            {b.timeRemaining}
          </p>
          <Countdown endsAt={endsAt} size="lg" />
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted">
                {dict.common.currentBid}
              </p>
              <p
                key={current}
                className="price-flash mt-1 inline-block font-mono text-2xl font-semibold tabular-nums sm:text-3xl"
              >
                {formatRupiah(current)}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-muted">
              <p>{bidCount} {dict.common.bids}</p>
              <p className="mt-0.5">{lot.watchCount} {dict.common.watchers}</p>
            </div>
          </div>
          <p className="mt-2 truncate text-xs">
            {leader ? (
              <>
                {b.leading}{" "}
                <span className="font-mono font-semibold text-ink">{leader}</span>
              </>
            ) : (
              b.noBidsYet
            )}
          </p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold ${
              reserveMet ? "text-success" : "text-amber"
            }`}
          >
            <IconCheck size={13} />
            {!lot.hasReserve
              ? dict.common.noReserve
              : reserveMet
                ? dict.common.reserveMet
                : dict.common.reserveNotMet}
          </p>
        </div>

        {success ? (
          <SuccessCard success={success} b={b} onBidAgain={() => setSuccess(null)} />
        ) : signedIn ? (
          <>
            <div>
              <label className="field-label" htmlFor="maxbid">
                {b.yourMax}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-muted">
                  Rp
                </span>
                <input
                  id="maxbid"
                  inputMode="numeric"
                  className="input pl-10 font-mono"
                  placeholder={nextMin.toLocaleString("en-ID")}
                  value={rawMax}
                  onChange={(e) =>
                    setRawMax(
                      e.target.value
                        .replace(/[^\d]/g, "")
                        .replace(/\B(?=(\d{3})+(?!\d))/g, "."),
                    )
                  }
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {quickOptions.map((q, i) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setRawMax(q.toLocaleString("en-ID"))}
                    className="rounded-full border border-line bg-canvas px-3 py-1.5 font-mono text-xs font-medium transition-colors hover:border-bronze-soft hover:bg-soft"
                  >
                    {i === 0 ? "Min " : ""}
                    {formatRupiah(q, { compact: true })}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.72rem] leading-snug text-muted">
                {b.minNow}{" "}
                <span className="font-mono font-semibold text-muted-ink">
                  {formatRupiah(nextMin)}
                </span>
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-oxblood/25 bg-oxblood-soft px-3.5 py-2.5 text-sm font-medium text-oxblood"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={maxAmount < nextMin}
              onClick={() => {
                setError(null);
                setReviewing(true);
              }}
              className="btn btn-primary btn-lg btn-block"
            >
              {b.place}
            </button>
            <ProxyNote b={b} antiSnipe={timeLeft.totalMs <= 120_000} />
          </>
        ) : (
          <div className="space-y-3 rounded-xl border border-line bg-cream p-4 text-center">
            <p className="text-sm text-muted-ink">{b.signedOutBody}</p>
            <Link
              href={`/sign-in?next=/auctions/${lot.slug}`}
              className="btn btn-primary btn-block"
            >
              {b.signedOutCta} <IconArrow size={16} className="arrow" />
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
          <WatchButton
            lotId={lot.id}
            initialWatching={watching}
            signedIn={signedIn}
            variant="panel"
          />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <IconShield size={14} className="text-success" />
            {b.buyerProtection}
          </span>
        </div>
      </div>

      {/* Sticky thumb-friendly mobile bid bar (Fitts's Law) */}
      {isLive && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_30px_-18px_rgba(23,20,15,0.5)] backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted">
                {dict.common.currentBid}
              </p>
              <p className="truncate font-mono text-base font-semibold tabular-nums">
                {formatRupiah(current)}
              </p>
            </div>
            <Countdown endsAt={endsAt} />
            <a href="#bid-panel" className="btn btn-primary min-h-[48px]">
              {dict.common.bid}
            </a>
          </div>
        </div>
      )}

      {/* Review dialog — confirmation prevents error, builds confidence */}
      {reviewing && (
        <div className="fixed inset-0 z-[130] grid place-items-center p-4">
          <button
            className="sheet-backdrop absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
            onClick={() => !submitting && setReviewing(false)}
            aria-label={b.cancel}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            className="modal-panel surface relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
          >
            <button
              className="icon-btn absolute right-3 top-3"
              onClick={() => !submitting && setReviewing(false)}
              aria-label={b.cancel}
            >
              <IconClose size={18} />
            </button>
            <span className="medallion">
              <IconTarget size={16} />
            </span>
            <h3 id="review-title" className="mt-4 font-serif text-2xl">
              {b.reviewTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-ink">
              {b.reviewBodyA}{" "}
              <span className="font-mono font-semibold text-ink">
                {formatRupiah(maxAmount)}
              </span>
              {b.reviewBodyB}
            </p>
            <dl className="mt-4 space-y-2 rounded-xl border border-line bg-cream p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{b.current}</dt>
                <dd className="font-mono font-semibold">{formatRupiah(current)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{b.minAccepted}</dt>
                <dd className="font-mono font-semibold">{formatRupiah(nextMin)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{b.yourCeiling}</dt>
                <dd className="font-mono font-semibold text-bronze-deep">
                  {formatRupiah(maxAmount)}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <button
                className="btn btn-outline flex-1"
                onClick={() => setReviewing(false)}
                disabled={submitting}
              >
                {b.cancel}
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={submitBid}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                    {b.placing}
                  </>
                ) : (
                  b.confirm
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProxyNote({
  b,
  antiSnipe = false,
}: {
  b: Dict["bid"];
  antiSnipe?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl bg-info-soft/60 p-4 text-[0.74rem] leading-relaxed text-info">
      <p className="font-semibold">{b.proxyTitle}</p>
      <p>{b.proxyBody}</p>
      {antiSnipe && <p className="font-semibold text-oxblood">{b.antiSnipeNote}</p>}
    </div>
  );
}

function SuccessCard({
  success,
  b,
  onBidAgain,
}: {
  success: { amount: number; extended: boolean; leading: boolean };
  b: Dict["bid"];
  onBidAgain: () => void;
}) {
  return (
    <div className="success-burst rounded-xl border border-success/30 bg-success-soft p-5 text-center">
      <span className="toast-check mx-auto grid h-12 w-12 place-items-center rounded-full bg-success text-white">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12.5l5 5L20 6.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="mt-3 font-serif text-xl text-ink">
        {success.leading ? b.successLead : b.successIn}
      </p>
      <p className="mt-1 text-xs text-muted-ink">
        {b.successCeiling} {formatRupiah(success.amount)} {b.successRecorded}
        {success.extended && b.successExtended}
      </p>
      <button onClick={onBidAgain} className="btn btn-outline mt-4 w-full">
        {b.raiseMax}
      </button>
    </div>
  );
}
