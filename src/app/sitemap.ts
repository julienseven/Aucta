import type { MetadataRoute } from 'next';
import { browseAuctions } from '@/lib/server/marketplace';
import { absoluteUrl } from '@/lib/seo';

const PUBLIC_ROUTES = [
  '/',
  '/auctions',
  '/sold',
  '/sell',
  '/auction-rules',
  '/buyer-protection',
  '/seller-policy',
  '/prohibited-items',
  '/privacy',
  '/terms',
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map(path => ({
    url: absoluteUrl(path),
    changeFrequency: path === '/' || path === '/auctions' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : path === '/auctions' ? 0.9 : 0.6,
  }));

  try {
    const auctions = await browseAuctions();
    const publicLots: MetadataRoute.Sitemap = auctions
      .filter(auction => !auction.sample && ['SCHEDULED', 'LIVE', 'PAID', 'FULFILLMENT', 'COMPLETED'].includes(auction.status))
      .map(auction => ({
        url: absoluteUrl(`/auction/${encodeURIComponent(auction.slug)}`),
        lastModified: new Date(auction.soldAt || auction.endsAt),
        changeFrequency: auction.status === 'LIVE' ? 'hourly' : 'weekly',
        priority: auction.status === 'LIVE' ? 0.8 : 0.6,
        images: auction.images.map(image => absoluteUrl(image)),
      }));
    return [...staticRoutes, ...publicLots];
  } catch {
    return staticRoutes;
  }
}
