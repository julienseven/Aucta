import type { Metadata } from 'next';
import Link from 'next/link';
import { MARKETPLACE_CONFIG } from '@/lib/config';
import { getCurrentUser } from '@/lib/server/marketplace';

export const metadata: Metadata = { title: 'Sell with AUCTA' };

export default async function SellPage() {
  const user = await getCurrentUser();
  const sellerFee = MARKETPLACE_CONFIG.sellerFeeBps / 100;

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Something special in your collection?</p>
        <h1 className="page-title">Let the right people find it.</h1>
        <p>AUCTA is an auction floor for considered objects — watches, cameras, cards, sneakers, design, gaming and related lots. Listing tools are not on this page yet.</p>
      </header>
      <div className="split">
        <section>
          <h2>Who it is for</h2>
          <p>Sellers who can photograph honestly, describe flaws, and ship after the hammer. Verification is a server decision, not a badge you assign yourself.</p>
          <h2>How a sale is meant to run</h2>
          <p>You consign an object. AUCTA reviews it. If it is scheduled, collectors bid in public increments with private maximums. If it sells, an order is opened with a payment window. You ship. The buyer confirms. Reviews belong to completed trades only.</p>
        </section>
        <section>
          <h2>Current commercial policy</h2>
          <p>Seller commission is currently {sellerFee}% of the hammer price, stored as {MARKETPLACE_CONFIG.sellerFeeBps} basis points. Buyer fee is currently {MARKETPLACE_CONFIG.buyerFeeBps / 100}%. These figures are product configuration, not a negotiated contract.</p>
          <p className="legal-note">Requires legal review. Nothing on this page is an offer to consign, a guarantee of sale, or a promise of payout timing.</p>
          <p>
            <Link href="/seller-policy">Seller standards</Link> · <Link href="/prohibited-items">Prohibited items</Link> · <Link href="/auction-rules">How bidding works</Link>
          </p>
        </section>
      </div>
      {(user?.role === 'seller' || user?.role === 'admin') ? (
        <p><Link className="button" href="/selling">Go to your selling desk</Link></p>
      ) : user ? (
        <p className="notice">You are signed in as a collector. Seller onboarding and the listing writer arrive in a later milestone. There is no application form here.</p>
      ) : (
        <p><Link className="button" href="/sign-in?next=/sell">Sign in to continue</Link></p>
      )}
    </div>
  );
}
