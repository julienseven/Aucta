import { describe, expect, it } from 'vitest';
import type { Auction } from '@/lib/domain';
import { absoluteUrl, auctionStructuredData, isPublicSite, serializeJsonLd, siteOrigin } from './seo';

const auction: Auction = {
  id: 'auction-1', listingId: 'listing-1', slug: 'a-rare-watch', title: 'A rare watch', subtitle: 'A considered example',
  category: 'Watches', categorySlug: 'watches', brand: 'Example', condition: 'Excellent', description: 'Public description',
  flaws: '', provenance: '', attributes: {}, images: ['/images/watch.jpg'], imageAlt: 'Watch',
  seller: { id: 'seller-1', name: 'Verified Collector', city: 'Bandung', verified: true, joinedAt: '2026-01-01T00:00:00.000Z', rating: null, completedSales: 2 },
  status: 'LIVE', startingPrice: 1_000_000, currentPrice: 1_500_000, minimumBid: 1_600_000, bidCount: 3, bidderCount: 2,
  watchCount: 4, startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-30T00:00:00.000Z', serverTime: '2026-09-21T00:00:00.000Z',
  reserveMet: false, hasReserve: true, featured: false, sample: false, shippingAmount: 100_000, ownMaximum: 9_000_000,
};

describe('SEO helpers', () => {
  it('accepts only web origins and resolves absolute URLs', () => {
    expect(siteOrigin('https://aucta.example/path')).toBe('https://aucta.example');
    expect(siteOrigin('javascript:alert(1)')).toBe('http://localhost:3000');
    expect(absoluteUrl('/auction/example', 'https://aucta.example')).toBe('https://aucta.example/auction/example');
    expect(isPublicSite('https://aucta.example', 'false')).toBe(true);
    expect(isPublicSite('http://localhost:3000', 'false')).toBe(false);
    expect(isPublicSite('https://aucta.example', 'true')).toBe(false);
  });

  it('emits public auction data without private bidding or reserve fields', () => {
    const data = auctionStructuredData(auction, 'https://aucta.example');
    const json = JSON.stringify(data);
    expect(data.offers).toMatchObject({ price: 1_500_000, priceCurrency: 'IDR', priceValidUntil: auction.endsAt });
    expect(json).not.toContain('ownMaximum');
    expect(json).not.toContain('reserveMet');
    expect(json).not.toContain('hasReserve');
    expect(json).not.toContain('seller-1');
  });

  it('escapes markup-significant characters in JSON-LD', () => {
    expect(serializeJsonLd({ name: '</script>' })).toContain('\\u003c/script>');
  });
});
