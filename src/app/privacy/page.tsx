import type { Metadata } from 'next';
import { PolicyPage } from '@/components/pages/policy';

export const metadata: Metadata = { title: 'Privacy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <PolicyPage eyebrow="Your information" title="Privacy">
      {/* LEGAL_REVIEW_REQUIRED */}
      <p>AUCTA stores what it needs to run auctions: account email, a public bidding alias, watchlists, bids, orders, and — for winners and sellers — a delivery address used in settlement. Public catalogue pages show a seller city and province, not a street address.</p>
      <p>Other bidders see aliases and visible prices, not your name, email or private maximum. Reserve amounts and competing ceilings are not sent to the browser.</p>
      <p>Sign-in uses email links and optional Google through the configured auth provider. Local development identities exist only in explicit local mode on this computer.</p>
      <p>This page does not claim a legal basis, retention schedule, cross-border transfer model or marketing opt-out. A privacy notice for Indonesia and any other launch market requires legal review before collection beyond what the product already stores to function.</p>
    </PolicyPage>
  );
}
