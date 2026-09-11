import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage } from '@/components/pages/policy';

export const metadata: Metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <PolicyPage eyebrow="House rules" title="Terms of use">
      {/* LEGAL_REVIEW_REQUIRED */}
      <p>AUCTA is an online auction marketplace for collectible objects, presented in English, with prices in Indonesian rupiah. It is not a bank, wallet, crypto venue, broker-dealer or escrow company.</p>
      <p>Using the site means you can browse public lots. Bidding, watching, buying and selling require a signed-in account. Server records, not the browser, decide who is leading, whether a reserve is met, who won, and whether an order exists.</p>
      <p>These notes describe how the product is built to behave. They are not a complete consumer contract, not a waiver, and not a limitation of statutory rights. Counsel must review them before they are treated as binding terms.</p>
      <p>Related pages: <Link href="/privacy">Privacy</Link>, <Link href="/auction-rules">How bidding works</Link>, <Link href="/buyer-protection">Buyer protection</Link>, <Link href="/seller-policy">Seller standards</Link>, <Link href="/prohibited-items">Prohibited items</Link>.</p>
    </PolicyPage>
  );
}
