import type { Metadata } from 'next';
import type { Auction } from '@/lib/domain';
import { browseAuctions } from '@/lib/server/marketplace';
import { Catalogue } from '@/components/pages/catalogue';
import { catalogueSort, catalogueStatus, queryValue } from '@/components/pages/helpers';
import { publicError } from '@/components/pages/protect';

export const metadata: Metadata = {
  title: 'Auctions',
  description: 'Browse live and upcoming collectible auctions on AUCTA.',
  alternates: { canonical: '/auctions' },
};

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = queryValue(params.q);
  const category = queryValue(params.category);
  const condition = queryValue(params.condition);
  const status = queryValue(params.status);
  const minPrice = queryValue(params.minPrice);
  const maxPrice = queryValue(params.maxPrice);
  const sort = queryValue(params.sort);
  let auctions: Auction[] = [];
  let error = '';
  try {
    auctions = await browseAuctions({
      q,
      category,
      condition,
      status: catalogueStatus(status),
      minPrice,
      maxPrice,
      sort: catalogueSort(sort),
    });
    if (!status || status === 'all') {
      auctions = auctions.filter(item => item.status === 'LIVE' || item.status === 'SCHEDULED');
    }
  } catch (caught) {
    error = publicError(caught, 'The catalogue could not be loaded. Please try again.');
  }

  return (
    <Catalogue
      eyebrow="Open bidding"
      title="The auctions"
      intro="Live, upcoming and recently decided lots. Filters stay in the address bar, so a view can be shared."
      auctions={auctions}
      values={{ q, category, condition, status, minPrice, maxPrice, sort }}
      error={error}
      empty="Nothing matches this view. Try another category or clear the filters."
    />
  );
}
