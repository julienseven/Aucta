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
    <div className="page">
      <header className="page-header">
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
          <div className="auction-grid">
            {auctions.map((auction, index) => <AuctionCard key={auction.id} auction={auction} priority={index < 2} />)}
          </div>
        )}
      </div>
    </div>
  );
}
