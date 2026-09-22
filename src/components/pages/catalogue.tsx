import type { Auction } from '@/lib/domain';
import { AuctionCard } from '@/components/auction-card';
import { Filters, type FilterValues } from './filters';

export function Catalogue({
  eyebrow,
  title,
  intro,
  auctions,
  values,
  error,
  empty,
  lockStatus,
  action = '/auctions',
}: {
  eyebrow: string;
  title: string;
  intro: string;
  auctions: Auction[];
  values: FilterValues;
  error?: string;
  empty: string;
  lockStatus?: string;
  action?: string;
}) {
  return (
    <div className="page catalogue-page">
      <header className="page-header catalogue-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p>{intro}</p>
      </header>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="catalogue-layout">
        <Filters key={JSON.stringify(values)} values={values} action={action} lockStatus={lockStatus} />
        {auctions.length === 0 && !error ? (
          <p className="empty-state">{empty}</p>
        ) : (
          <section className="catalogue-results" aria-labelledby="catalogue-results-title" aria-describedby="result-count">
            <header className="catalogue-toolbar">
              <div>
                <p className="eyebrow">Current view</p>
                <h2 id="catalogue-results-title">Available lots</h2>
              </div>
              <p className="result-count" id="result-count">{auctions.length} {auctions.length === 1 ? 'lot' : 'lots'}</p>
            </header>
            <div className="catalogue-summary-card" aria-live="polite">
              <span className="eyebrow">Market overview</span>
              <strong>{auctions.length}</strong>
              <small>{values.status && values.status !== 'all' ? 'filtered lots in view' : 'lots currently in the catalogue'}</small>
            </div>
            <div className="auction-grid catalogue-grid">
              {auctions.map((auction, index) => <AuctionCard key={auction.id} auction={auction} priority={index < 2} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
