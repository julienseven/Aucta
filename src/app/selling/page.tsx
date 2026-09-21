import type { Metadata } from 'next';
import Link from 'next/link';
import type { Auction } from '@/lib/domain';
import { getSellingData } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { NewListingButton } from '@/components/pages/listing-writer';
import { formatWhen, money, statusLabel } from '@/components/pages/helpers';

export const metadata: Metadata = { title: 'Selling', robots: { index: false, follow: false } };

const LIVE = new Set(['LIVE', 'SCHEDULED']);
const SOLD = new Set(['PAID', 'FULFILLMENT', 'COMPLETED']);
const WRITER = new Set(['DRAFT', 'PENDING_REVIEW', 'REJECTED']);

function lotHref(auction: Auction): string {
  return WRITER.has(auction.status) ? `/selling/${auction.listingId}` : `/auction/${auction.slug}`;
}

function LotTable({ lots }: { lots: Auction[] }) {
  return (
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
        {lots.map(auction => (
          <tr key={auction.id}>
            <td><Link href={lotHref(auction)}>{auction.title.trim() || 'Untitled draft'}</Link></td>
            <td>{statusLabel(auction.status)}</td>
            <td>{money(auction.currentPrice)}</td>
            <td>{auction.bidCount}</td>
            <td>{formatWhen(auction.endsAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
        <p>AUCTA is for collectors who already look after objects carefully. Open a seller desk from the sell page. Verification is a server decision, not a badge you assign yourself.</p>
        <p><Link className="button" href="/sell">Open a seller desk</Link></p>
      </div>
    );
  }

  const groups = [
    { title: 'Draft', items: auctions.filter(item => item.status === 'DRAFT') },
    { title: 'Pending review', items: auctions.filter(item => item.status === 'PENDING_REVIEW') },
    { title: 'Rejected', items: auctions.filter(item => item.status === 'REJECTED') },
    { title: 'Live', items: auctions.filter(item => LIVE.has(item.status)) },
    { title: 'Sold', items: auctions.filter(item => SOLD.has(item.status)) },
  ];
  const grouped = new Set(groups.flatMap(group => group.items.map(item => item.id)));
  const other = auctions.filter(item => !grouped.has(item.id));

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Seller desk</p>
        <h1 className="page-title">Your lots.</h1>
        {user.sellerVerified && <p className="badge">Verified seller</p>}
        <div className="page-actions"><NewListingButton /></div>
      </header>
      <div className="dashboard-grid">
        <div className="stat"><span className="label">Gross sales</span><strong>{money(grossSales)}</strong></div>
        <div className="stat"><span className="label">Completed auctions</span><strong>{completedAuctions}</strong></div>
        <div className="stat"><span className="label">Lots</span><strong>{auctions.length}</strong></div>
      </div>
      <section>
        <h2>Listings</h2>
        {auctions.length === 0 ? (
          <p className="empty-state">No lots on this desk yet. Use “New listing” above to begin a draft; nothing is published until review.</p>
        ) : (
          <>
            {groups.filter(group => group.items.length > 0).map(group => (
              <div className="desk-group" key={group.title}>
                <h3>{group.title}</h3>
                <LotTable lots={group.items} />
              </div>
            ))}
            {other.length > 0 && (
              <div className="desk-group">
                <h3>Other lots</h3>
                <LotTable lots={other} />
              </div>
            )}
          </>
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
