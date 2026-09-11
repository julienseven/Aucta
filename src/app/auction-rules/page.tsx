import type { Metadata } from 'next';
import Link from 'next/link';
import { formatIDR } from '@/lib/auction';
import { MARKETPLACE_CONFIG } from '@/lib/config';
import { PolicyPage } from '@/components/pages/policy';

export const metadata: Metadata = { title: 'How bidding works' };

export default function AuctionRulesPage() {
  const extension = MARKETPLACE_CONFIG.extensionWindowMs / 1000;
  const incrementText = MARKETPLACE_CONFIG.increments
    .map(tier => (Number.isFinite(tier.below) ? `below ${formatIDR(tier.below)}: ${formatIDR(tier.amount)}` : `otherwise ${formatIDR(tier.amount)}`))
    .join('; ');

  return (
    <PolicyPage eyebrow="The market decides" title="How bidding works">
      {/* LEGAL_REVIEW_REQUIRED */}
      <p>AUCTA runs proxy auctions. You submit a private maximum in whole rupiah. The site bids on your behalf up to that ceiling. Other collectors see aliases and the visible price, not your maximum and not anyone else’s.</p>
      <p>Default increments in current configuration: {incrementText}. An auction may override its increment. The next acceptable bid is decided on the server when the bid is accepted.</p>
      <p>If a lot has a reserve, the page shows whether that reserve is met. It never shows the reserve amount. A lot that ends below reserve is a no-sale.</p>
      <p>A qualifying competitive bid in the last {extension} seconds extends the end by {extension} seconds. Raising a ceiling while you already lead does not, by itself, extend the clock. There is no self-service bid withdrawal in this version.</p>
      <p>Closing is independent of your browser. If you win, an order is opened with snapshotted prices and fees. Read <Link href="/buyer-protection">buyer protection</Link> for payment and disputes. These rules describe intended software behaviour; they are not a complete auction statute.</p>
    </PolicyPage>
  );
}
