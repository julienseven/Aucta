import type { Metadata } from 'next';
import type { Auction } from '@/lib/domain';
import { browseAuctions } from '@/lib/server/marketplace';
import { Catalogue } from '@/components/pages/catalogue';
import { catalogueSort, queryValue } from '@/components/pages/helpers';
import { publicError } from '@/components/pages/protect';

export const metadata: Metadata = { title: 'Price archive' };

export default async function SoldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = queryValue(params.q);
  const category = queryValue(params.category);
  const condition = queryValue(params.condition);
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
      status: 'sold',
      minPrice,
      maxPrice,
      sort: catalogueSort(sort),
    });
  } catch (caught) {
    error = publicError(caught, 'The price archive could not be loaded. Please try again.');
  }

  return (
    <Catalogue
      eyebrow="The market has spoken"
      title="Price archive"
      intro="Settled lots, with the prices the market actually reached. Past results do not predict the next hammer."
      auctions={auctions}
      values={{ q, category, condition, status: 'sold', minPrice, maxPrice, sort }}
      error={error}
      empty="No settled prices to show yet."
      lockStatus="sold"
      action="/sold"
    />
  );
}
