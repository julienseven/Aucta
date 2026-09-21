import type { Auction } from '@/lib/domain';

const FALLBACK_ORIGIN = 'http://localhost:3000';

export function siteOrigin(value = process.env.APP_URL): string {
  try {
    const url = new URL(value || FALLBACK_ORIGIN);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return FALLBACK_ORIGIN;
    return url.origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export function isPublicSite(value = process.env.APP_URL, localMode = process.env.AUCTA_LOCAL_MODE): boolean {
  if (localMode === 'true' || !value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function absoluteUrl(path: string, origin = siteOrigin()): string {
  return new URL(path, `${origin}/`).toString();
}

function schemaCondition(condition: Auction['condition']): string {
  if (condition === 'New') return 'https://schema.org/NewCondition';
  return 'https://schema.org/UsedCondition';
}

function schemaAvailability(status: Auction['status']): string {
  if (status === 'LIVE') return 'https://schema.org/LimitedAvailability';
  if (status === 'SCHEDULED') return 'https://schema.org/PreOrder';
  return 'https://schema.org/SoldOut';
}

/** Public auction fields only: never add reserves, bidder identities, or private maxima. */
export function auctionStructuredData(auction: Auction, origin = siteOrigin()) {
  const url = absoluteUrl(`/auction/${encodeURIComponent(auction.slug)}`, origin);
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url,
    price: auction.currentPrice || auction.startingPrice,
    priceCurrency: 'IDR',
    availability: schemaAvailability(auction.status),
    itemCondition: schemaCondition(auction.condition),
    seller: {
      '@type': 'Organization',
      name: auction.seller.name,
    },
  };
  if (auction.status === 'LIVE' || auction.status === 'SCHEDULED') {
    offer.priceValidUntil = auction.endsAt;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#lot`,
    url,
    name: auction.title,
    description: auction.description || auction.subtitle || undefined,
    image: auction.images.map(image => absoluteUrl(image, origin)),
    category: auction.category,
    brand: auction.brand ? { '@type': 'Brand', name: auction.brand } : undefined,
    itemCondition: schemaCondition(auction.condition),
    offers: offer,
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
