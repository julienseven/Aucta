import type { Metadata } from 'next';
import Link from 'next/link';
import { AuctionCard } from '@/components/auction-card';
import { getAccountData } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { SignOutButton } from '@/components/pages/sign-out-button';
import { formatWhen, money, statusLabel } from '@/components/pages/helpers';

export const metadata: Metadata = { title: 'Your account' };

export default async function AccountPage() {
  const result = await loadProtected('/account', getAccountData);
  if (!result.ok) {
    return (
      <div className="page">
        <header className="page-header"><h1 className="page-title">Your account</h1></header>
        <p className="error-banner" role="alert">{result.error}</p>
      </div>
    );
  }

  const { user, bidding, watching, orders, notifications } = result.data;
  const purchases = orders.filter(order => order.buyerId === user.id);
  const actions = [
    ...bidding.filter(auction => auction.isLeading === false && typeof auction.ownMaximum === 'number').map(auction => ({ key: `bid-${auction.id}`, eyebrow: 'Outbid', title: auction.title, detail: `Next bid ${money(auction.minimumBid)}`, href: `/auction/${auction.slug}`, label: 'Bid again' })),
    ...purchases.filter(order => order.status === 'AWAITING_PAYMENT').map(order => ({ key: `pay-${order.id}`, eyebrow: 'Payment due', title: order.auction.title, detail: `Pay ${money(order.total)} by ${formatWhen(order.paymentDeadline)}`, href: `/orders/${order.id}`, label: 'Open order' })),
    ...purchases.filter(order => order.status === 'FULFILLMENT' && !order.receivedAt).map(order => ({ key: `receive-${order.id}`, eyebrow: 'In transit', title: order.auction.title, detail: order.trackingNumber ? `${order.carrier ?? 'Shipment'} · ${order.trackingNumber}` : 'Check delivery details', href: `/orders/${order.id}`, label: 'Track order' })),
    ...purchases.filter(order => order.status === 'FULFILLMENT' && order.receivedAt && !order.review).map(order => ({ key: `review-${order.id}`, eyebrow: 'Finish the order', title: order.auction.title, detail: 'Your receipt is confirmed. Share an honest review.', href: `/orders/${order.id}`, label: 'Review seller' })),
  ];

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Your AUCTA</p>
        <h1 className="page-title">Hello, {user.name.split(' ')[0]}.</h1>
        <p className="muted">{user.email ?? 'Signed in'}{user.local ? ' · Local development session' : ''}</p>
      </header>
      {actions.length > 0 && <section className="action-required" aria-labelledby="action-required-title">
        <div><p className="eyebrow">Next steps</p><h2 id="action-required-title">Action required.</h2></div>
        <div className="action-list">{actions.map(action => <article key={action.key}>
          <div><p className="eyebrow">{action.eyebrow}</p><h3>{action.title}</h3><p className="muted">{action.detail}</p></div>
          <Link className="button" href={action.href}>{action.label}</Link>
        </article>)}</div>
      </section>}
      <div className="dashboard-grid">
        <div className="stat"><span className="label">Active bids</span><strong>{bidding.length}</strong></div>
        <div className="stat"><span className="label">Watching</span><strong>{watching.length}</strong></div>
        <div className="stat"><span className="label">Purchases</span><strong>{purchases.length}</strong></div>
      </div>
      <p className="split">
        <Link className="button-outline" href="/watchlist">Watchlist</Link>
        {(user.role === 'seller' || user.role === 'admin') && <Link className="button-outline" href="/selling">Selling desk</Link>}
        {user.role === 'buyer' && <Link className="button-outline" href="/sell">Sell with AUCTA</Link>}
        {user.role === 'admin' && <Link className="button-outline" href="/admin">Admin</Link>}
        <SignOutButton />
      </p>
      <section>
        <h2>Bidding</h2>
        {bidding.length === 0 ? (
          <p className="empty-state">You have no live bids. <Link href="/auctions">Find something worth competing for</Link>.</p>
        ) : (
          <div className="auction-grid">
            {bidding.map(auction => (
              <div key={auction.id}>
                {auction.isLeading === true && <p className="badge">You are leading</p>}
                {auction.isLeading === false && typeof auction.ownMaximum === 'number' && <p className="badge">Outbid</p>}
                {typeof auction.ownMaximum === 'number' && <p className="muted">Your maximum {money(auction.ownMaximum)}</p>}
                <AuctionCard auction={auction} />
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2>Won and purchases</h2>
        {purchases.length === 0 ? (
          <p className="empty-state">No purchases yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Hammer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment by</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(order => (
                <tr key={order.id}>
                  <td><Link href={`/orders/${order.id}`}>{order.auction.title}</Link></td>
                  <td>{money(order.winningBid)}</td>
                  <td>{money(order.total)}</td>
                  <td>{statusLabel(order.status)}</td>
                  <td>{formatWhen(order.paymentDeadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Notifications</h2>
        {notifications.length === 0 ? (
          <p className="empty-state">No notices yet. Outbids, wins and payment reminders will appear here.</p>
        ) : (
          <ul className="activity-list">
            {notifications.map(item => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.message}</p>
                  {item.href && <Link href={item.href}>Open</Link>}
                </div>
                <time dateTime={item.createdAt}>{formatWhen(item.createdAt)}</time>
                {!item.readAt && <span className="badge">New</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
