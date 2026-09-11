import type { Metadata } from 'next';
import Link from 'next/link';
import { getSellingData } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { formatWhen, money, statusLabel } from '@/components/pages/helpers';

export const metadata: Metadata = { title: 'Selling' };

export default async function SellingPage() {
  const result = await loadProtected('/selling', getSellingData);
  if (!result.ok) {
    return (
      <div className="page">
        <header className="page-header"><h1 className="page-title">Selling</h1></header>
        <p className="error-banner" role="alert">{result.error}</p>
      </div>
    );
  }

  const { user, auctions, orders, grossSales, completedAuctions } = result.data;
  if (user.role === 'buyer') {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">Sell with AUCTA</p>
          <h1 className="page-title">Selling is a separate desk.</h1>
        </header>
        <p>AUCTA is for collectors who already look after objects carefully. Listing tools are not in this slice. When seller onboarding opens, it will live here — not as a public form on this page.</p>
        <p><Link className="button" href="/sell">How selling works</Link></p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Seller desk</p>
        <h1 className="page-title">Your lots.</h1>
        {user.sellerVerified && <p className="badge">Verified seller</p>}
      </header>
      <div className="dashboard-grid">
        <div className="stat"><span className="label">Gross sales</span><strong>{money(grossSales)}</strong></div>
        <div className="stat"><span className="label">Completed auctions</span><strong>{completedAuctions}</strong></div>
        <div className="stat"><span className="label">Lots</span><strong>{auctions.length}</strong></div>
      </div>
      <section>
        <h2>Listings</h2>
        {auctions.length === 0 ? (
          <p className="empty-state">No lots on this desk yet. <Link href="/sell">Read how selling works</Link>.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Status</th>
                <th>Price</th>
                <th>Bids</th>
                <th>Ends</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map(auction => (
                <tr key={auction.id}>
                  <td><Link href={`/auction/${auction.slug}`}>{auction.title}</Link></td>
                  <td>{statusLabel(auction.status)}</td>
                  <td>{money(auction.currentPrice)}</td>
                  <td>{auction.bidCount}</td>
                  <td>{formatWhen(auction.endsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Orders</h2>
        {orders.length === 0 ? (
          <p className="empty-state">No seller orders yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Hammer</th>
                <th>Seller fee</th>
                <th>Shipping</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td><Link href={`/orders/${order.id}`}>{order.auction.title}</Link></td>
                  <td>{money(order.winningBid)}</td>
                  <td>{money(order.sellerFee)}</td>
                  <td>{money(order.shippingAmount)}</td>
                  <td>{statusLabel(order.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
