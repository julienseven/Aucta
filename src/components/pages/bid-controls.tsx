'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Auction } from '@/lib/domain';
import { formatIDR, parseIDR } from '@/lib/auction';
import { Countdown } from '@/components/countdown';
import { WatchButton } from '@/components/watch-button';
import { Dialog, Feedback, mutate } from '@/components/ui';
import { formatWhen, money, signInPath } from './helpers';

type Mode = 'place' | 'max' | null;

export function BidControls({ auction, signedIn, onAccepted }: { auction: Auction; signedIn: boolean; onAccepted: () => Promise<void> }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [amount, setAmount] = useState(String(auction.minimumBid));
  const [busy, setBusy] = useState(false);
  const pendingRequest = useRef<{ maximum: number; key: string } | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const live = auction.status === 'LIVE';
  const signIn = signInPath(`/auction/${auction.slug}`);

  function open(next: Exclude<Mode, null>) {
    if (!signedIn) {
      router.push(signIn);
      return;
    }
    setMode(next);
    setMessage('');
    setFailed(false);
    setAmount(String(next === 'max' && auction.ownMaximum ? Math.max(auction.ownMaximum + 1, auction.minimumBid) : auction.minimumBid));
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
      setMode(null);
      setMessage(result.is_leading ? 'Bid accepted. You are leading.' : 'Bid accepted. Another collector has an earlier or higher maximum.');
      await onAccepted();
      router.refresh();
    } catch (error) {
      const text = (error as Error).message;
      if (/sign|auth|session/i.test(text)) {
        router.push(signIn);
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
        {auction.hasReserve && <p className="badge">{auction.reserveMet ? 'Reserve met' : 'Reserve not met'}</p>}
        {typeof auction.ownMaximum === 'number' && <p>Your maximum {money(auction.ownMaximum)}</p>}
        {auction.isLeading === true && <p className="badge">You are leading</p>}
        {auction.isLeading === false && typeof auction.ownMaximum === 'number' && <p className="badge">You have been outbid</p>}
        {live && (
          <div className="split">
            <button className="button" type="button" onClick={() => open('place')}>Place bid</button>
            <button className="button button-outline" type="button" onClick={() => open('max')}>Set max bid</button>
          </div>
        )}
        {live && <p className="muted">Minimum {money(auction.minimumBid)}. Amounts above the visible price stay private. The server decides whether a bid is accepted.</p>}
        {!live && auction.status === 'SCHEDULED' && <p className="muted">The floor is not open yet.</p>}
        {!live && auction.status !== 'SCHEDULED' && <p className="muted">This auction is no longer taking bids.</p>}
        {message && mode === null && <Feedback message={message} error={failed} />}
        <WatchButton key={`${auction.id}:${auction.isWatching}`} auctionId={auction.id} watching={auction.isWatching ?? false} withLabel />
      </aside>
      {live && (
        <div className="sticky-bid">
          <div>
            <span className="label">Current bid</span>
            <strong>{money(auction.currentPrice)}</strong>
          </div>
          <Countdown endsAt={auction.endsAt} serverTime={auction.serverTime} compact />
          <button className="button" type="button" onClick={() => open('place')}>Place bid</button>
        </div>
      )}
      <Dialog open={mode !== null} onClose={() => setMode(null)} title={mode === 'max' ? 'Set a private maximum' : 'Place a bid'}>
        <p className="muted">
          {mode === 'max'
            ? 'AUCTA uses your maximum only as far as needed to lead. Other bidders never see this number.'
            : `Enter a whole rupiah amount of at least ${money(auction.minimumBid)}. Amounts above the visible price are treated as your private ceiling.`}
        </p>
        <form className="form" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <div className="field">
            <label className="field-label" htmlFor="bid-amount">{mode === 'max' ? 'Maximum bid (IDR)' : 'Your bid (IDR)'}</label>
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
          </div>
          <button className="button" type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'max' ? 'Save maximum' : 'Confirm bid'}</button>
          <Feedback message={message} error={failed} />
        </form>
      </Dialog>
    </>
  );
}
