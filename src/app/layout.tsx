import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { getCurrentUser } from '@/lib/server/auth';
import { isPublicSite, siteOrigin } from '@/lib/seo';
import './globals.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  applicationName: 'AUCTA',
  title: { default: 'AUCTA — Rare things. Real prices.', template: '%s — AUCTA' },
  description: 'A considered collection of rare and remarkable objects. Discover live auctions, follow the bidding, and find your next great object.',
  openGraph: {
    title: 'AUCTA — Rare things. Real prices.',
    description: 'A considered collection of rare and remarkable objects offered through transparent auctions.',
    siteName: 'AUCTA',
    type: 'website',
    url: '/',
    locale: 'en_ID',
  },
  twitter: { card: 'summary_large_image', title: 'AUCTA — Rare things. Real prices.', description: 'Objects worth competing for.' },
  robots: isPublicSite() ? { index: true, follow: true } : { index: false, follow: false },
};
export default async function RootLayout({children}:{children:React.ReactNode}){
  let user = null;
  try { user = await getCurrentUser(); } catch { user = null; }
  return <html lang="en"><body><Header user={user} local={process.env.AUCTA_LOCAL_MODE==='true'}/><main id="main" tabIndex={-1}>{children}</main><Footer/></body></html>;
}
