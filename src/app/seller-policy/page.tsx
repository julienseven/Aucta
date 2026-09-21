import type { Metadata } from 'next';
import Link from 'next/link';
import { MARKETPLACE_CONFIG } from '@/lib/config';
import { PolicyPage } from '@/components/pages/policy';

export const metadata: Metadata = { title: 'Seller standards', alternates: { canonical: '/seller-policy' } };

export default function SellerPolicyPage() {
  const sellerFee = MARKETPLACE_CONFIG.sellerFeeBps / 100;

  return (
    <PolicyPage eyebrow="Seller standards" title="Selling on AUCTA">
      {/* LEGAL_REVIEW_REQUIRED */}
      <p>Sellers are expected to photograph the object they hold, name obvious flaws, and ship the same object after a paid win. Verification is recorded on the seller profile by AUCTA, not by a self-serve badge.</p>
      <p>Shill bidding — including bidding on your own lot — is forbidden in the auction rules. Titles, reserves and starting prices must be whole rupiah. Prohibited categories stay off the floor; see <Link href="/prohibited-items">prohibited items</Link>.</p>
      <p>Current product configuration charges sellers {sellerFee}% of the hammer price. Payout timing, tax invoices and withholding are not specified here. Commission is not a promise that a lot will sell.</p>
      <p>Listing submission, image upload and seller onboarding are later milestones. This page does not accept applications and does not change your role.</p>
    </PolicyPage>
  );
}
