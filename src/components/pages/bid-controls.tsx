'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Auction } from '@/lib/domain';
import { formatIDR, parseIDR } from '@/lib/auction';
import { Countdown } from '@/components/countdown';
import { WatchButton } from '@/components/watch-button';
import { Alert, Dialog, Feedback, StatusBadge, mutate } from '@/components/ui';
import { formatWhen, money, signInPath } from './helpers';
import { clearIntent, intentDestination, readIntent } from '@/lib/sign-in-intent';

export function BidControls({ auction, signedIn, onAccepted }: { auction: Auction; signedIn: boolean; onAccepted: () => Promise<void> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(auction.minimumBid));
  const [busy, setBusy] = useState(false);
  const pendingRequest = useRef<{ maximum: number; key: string } | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const live = auction.status === 'LIVE';
  function signIn() {
    return signInPath(intentDestination(window.location.pathname + window.location.search + window.location.hash, { action: 'bid', auctionId: auction.id }));
  }

  useEffect(() => {
    if (!signedIn || readIntent(window.location.pathname + window.location.search, auction.id)?.action !== 'bid') return;
    const timer = window.setTimeout(() => {
      window.history.replaceState(null, '', clearIntent(window.location.pathname + window.location.search + window.location.hash));
      if (auction.status === 'LIVE') {
        setAmount(String(auction.ownMaximum ? Math.max(auction.ownMaximum + 1, auction.minimumBid) : auction.minimumBid));
        setOpen(true);
      } else {
        setFailed(true);
        setMessage('This auction is no longer open for bidding. No bid was placed.');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [signedIn, auction.id, auction.status, auction.minimumBid, auction.ownMaximum]);

  function openBid() {
    if (!signedIn) {
      router.push(signIn());
      return;
    }
    setOpen(true);
    setMessage('');
    setFailed(false);
    setAmount(String(auction.ownMaximum ? Math.max(auction.ownMaximum + 1, auction.minimumBid) : auction.minimumBid));
  }

  async function submit() {
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      const maximum = parseIDR(amount);
      if (maximum < auction.minimumBid) throw new Error(`Enter at least ${formatIDR(auction.minimumBid)}.`);
      if (pendingRequest.current?.maximum !== maximum) pendingRequest.current = { maximum, key: crypto.randomUUID() };
      const result = await mutate<{ is_leading: boolean; extended: boolean }>('/api/bids', { auctionId: auction.id, maximum, idempotencyKey: pendingRequest.current.key });
      pendingRequest.current = null;
      setOpen(false);
      setMessage(result.is_leading ? 'Bid accepted. You are leading.' : 'Bid accepted. Another collector has an earlier or higher maximum.');
      await onAccepted();
      router.refresh();
    } catch (error) {
      const text = (error as Error).message;
      if (/sign|auth|session/i.test(text)) {
        router.push(signIn());
        return;
      }
      setFailed(true);
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <aside className="bid-panel">
        <p className="eyebrow">{live ? 'Live auction' : auction.status === 'SCHEDULED' ? 'Upcoming' : 'Closed'}</p>
        <span className="label">{live || auction.status === 'SCHEDULED' ? 'Current bid' : 'Final price'}</span>
        <strong>{money(auction.currentPrice || auction.startingPrice)}</strong>
        <p className="muted">{auction.bidCount} bids · {auction.bidderCount} bidders · {auction.watchCount} watching</p>
        {live && <Countdown endsAt={auction.endsAt} serverTime={auction.serverTime} />}
        {auction.status === 'SCHEDULED' && <p>Bidding opens {formatWhen(auction.startsAt)} (Jakarta).</p>}
        {auction.hasReserve && <StatusBadge tone={auction.reserveMet ? 'success' : 'warning'}>{auction.reserveMet ? 'Reserve met' : 'Reserve not met'}</StatusBadge>}
        {typeof auction.ownMaximum === 'number' && <p>Your maximum {money(auction.ownMaximum)}</p>}
        {auction.isLeading === true && <StatusBadge tone="success">You are leading</StatusBadge>}
        {auction.isLeading === false && typeof auction.ownMaximum === 'number' && <StatusBadge tone="danger">You have been outbid</StatusBadge>}
        {live && <button className="button" type="button" onClick={openBid}>Place bid</button>}
        {live && <p className="muted">Minimum {money(auction.minimumBid)}. Enter the most you are willing to pay; AUCTA raises the visible price only as needed and keeps the rest private.</p>}
        {!live && auction.status === 'SCHEDULED' && <p className="muted">The floor is not open yet.</p>}
        {!live && auction.status !== 'SCHEDULED' && <p className="muted">This auction is no longer taking bids.</p>}
        {message && !open && <Alert tone={failed ? 'danger' : 'success'}>{message}</Alert>}
        <WatchButton key={`${auction.id}:${auction.isWatching}`} auctionId={auction.id} watching={auction.isWatching ?? false} withLabel />
      </aside>
      {live && (
        <div className="sticky-bid">
          <div>
            <span className="label">Current bid</span>
            <strong>{money(auction.currentPrice)}</strong>
          </div>
          <Countdown endsAt={auction.endsAt} serverTime={auction.serverTime} compact />
          <button className="button" type="button" onClick={openBid}>Place bid</button>
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Place your bid">
        <p className="muted">Enter your private maximum. AUCTA bids only as far as needed to lead, and other bidders never see this number.</p>
        <form className="form" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <div className="field">
            <label className="field-label" htmlFor="bid-amount">Your maximum (IDR)</label>
            <input
              className="input"
              id="bid-amount"
              name="maximum"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              required
            />
            <p className="field-help">Minimum {money(auction.minimumBid)}{parsePricePreview(amount)}</p>
          </div>
          <button className="button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Confirm maximum'}</button>
          <Feedback message={message} error={failed} />
        </form>
      </Dialog>
    </>
  );
}

function parsePricePreview(value: string): string {
  try {
    const parsed = parseIDR(value);
    return parsed > 0 ? ` · You entered ${formatIDR(parsed)}` : '';
  } catch {
    return '';
  }
}
