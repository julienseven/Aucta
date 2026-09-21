import type { MetadataRoute } from 'next';
import { absoluteUrl, isPublicSite, siteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!isPublicSite()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/account', '/admin', '/orders/', '/selling', '/sign-in', '/watchlist'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteOrigin(),
  };
}
