import type { Metadata } from 'next';
import Link from 'next/link';
import { AuctionCard } from '@/components/auction-card';
import { getWatchlist } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { money } from '@/components/pages/helpers';

export const metadata: Metadata = { title: 'Watchlist' };

export default async function WatchlistPage() {
  const result = await loadProtected('/watchlist', getWatchlist);
  if (!result.ok) {
    return (
      <div className="page">
        <header className="page-header"><h1 className="page-title">Watchlist</h1></header>
        <p className="error-banner" role="alert">{result.error}</p>
      </div>
    );
  }

  const auctions = result.data;
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Saved lots</p>
        <h1 className="page-title">Watchlist</h1>
        <p>Objects you are following. Leading and outbid notes appear when the auction knows your position.</p>
      </header>
      {auctions.length === 0 ? (
        <p className="empty-state">You are not watching any auctions yet. <Link href="/auctions">Browse the floor</Link>.</p>
      ) : (
        <div className="auction-grid">
          {auctions.map(auction => (
            <div key={auction.id}>
              {auction.isLeading === true && <p className="badge">You are leading</p>}
              {auction.isLeading === false && typeof auction.ownMaximum === 'number' && <p className="badge">Outbid</p>}
              {typeof auction.ownMaximum === 'number' && <p className="muted">Your maximum {money(auction.ownMaximum)}</p>}
              <AuctionCard auction={auction} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
