import type { Metadata } from 'next';
import Link from 'next/link';
import { MARKETPLACE_CONFIG } from '@/lib/config';
import { PolicyPage } from '@/components/pages/policy';

export const metadata: Metadata = { title: 'Buyer protection' };

export default function BuyerProtectionPage() {
  const hours = MARKETPLACE_CONFIG.paymentWindowMs / 3_600_000;
  const days = MARKETPLACE_CONFIG.disputeWindowMs / 86_400_000;

  return (
    <PolicyPage eyebrow="In good hands" title="Buyer protection">
      {/* LEGAL_REVIEW_REQUIRED */}
      <p>Lots are meant to show photographs, condition, flaw notes and provenance so you can decide what an object is worth. Sellers are asked to describe defects rather than hide them. That standard is a listing rule, not insurance.</p>
      <p>If you win, an order records the hammer price, any buyer fee, quoted shipping and a payment deadline. The current payment window in product configuration is {hours} hours. Payment collection is not complete in this slice; this page does not take card details and does not confirm that money moved.</p>
      <p>After payment, the seller is expected to ship. Disputes can be opened for issues such as an item not arriving or not matching the listing. The current dispute window in product configuration is {days} days. Reviews are case by case. AUCTA does not promise a refund, replacement, or a particular outcome.</p>
      <p>Read <Link href="/auction-rules">how bidding works</Link> and <Link href="/prohibited-items">what cannot be listed</Link>. Statutory consumer rights, if they apply, are not replaced by this draft.</p>
    </PolicyPage>
  );
}
