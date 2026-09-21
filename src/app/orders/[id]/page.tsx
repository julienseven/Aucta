import type { Metadata } from 'next';
import Link from 'next/link';
import { getOrder } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { formatWhen, money, statusLabel } from '@/components/pages/helpers';
import { OrderActions } from '@/components/pages/order-actions';
import { OrderProgress } from '@/components/pages/order-progress';

export const metadata: Metadata = { title: 'Order' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadProtected(`/orders/${id}`, () => getOrder(id));
  if (!result.ok) {
    return (
      <div className="page">
        <header className="page-header"><h1 className="page-title">Order</h1></header>
        <p className="error-banner" role="alert">{result.error}</p>
      </div>
    );
  }

  const order = result.data;
  if (!order) {
    return (
      <div className="page">
        <p className="empty-state">This order is not available on your account.</p>
        <p><Link href="/account">Back to your account</Link></p>
      </div>
    );
  }

  const buyer = result.user.id === order.buyerId;
  const seller = result.user.id === order.sellerId;

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">{buyer ? 'You won' : 'Sale'}</p>
        <h1 className="page-title">{order.auction.title}</h1>
        <p className="muted">{statusLabel(order.status)} · <Link href={`/auction/${order.auction.slug}`}>View lot</Link></p>
      </header>
      <OrderProgress order={order} />
      <div className="dashboard-grid">
        <div className="stat"><span className="label">Winning bid</span><strong>{money(order.winningBid)}</strong></div>
        {buyer && <div className="stat"><span className="label">Buyer fee</span><strong>{money(order.buyerFee)}</strong></div>}
        {seller && <div className="stat"><span className="label">Seller fee</span><strong>{money(order.sellerFee)}</strong></div>}
        <div className="stat"><span className="label">Shipping</span><strong>{money(order.shippingAmount)}</strong></div>
        <div className="stat"><span className="label">Total</span><strong>{money(order.total)}</strong></div>
      </div>
      {order.status === 'AWAITING_PAYMENT' && <p>Payment deadline {formatWhen(order.paymentDeadline)} (Jakarta).</p>}
      <OrderActions order={order} buyer={buyer} seller={seller} mockPaymentEnabled={result.user.local} />
      {order.address && (
        <section>
          <h2>Delivery</h2>
          <p>{order.address.name}</p>
          <p>{order.address.line1}</p>
          <p>{order.address.city}, {order.address.province} {order.address.postalCode}</p>
        </section>
      )}
      {(order.carrier || order.trackingNumber) && (
        <section>
          <h2>Shipment</h2>
          <p>{order.carrier} {order.trackingNumber}</p>
          {order.receivedAt ? <p className="muted">Received {formatWhen(order.receivedAt)} (Jakarta).</p> : <p className="muted">Tracking is entered by the seller. AUCTA does not verify carrier scans.</p>}
        </section>
      )}
      {order.review && (
        <section>
          <h2>Review</h2>
          <p>{order.review.rating}/5</p>
          <p>{order.review.text}</p>
        </section>
      )}
      {result.user.local
        ? <p className="muted">Development order. Mock payments collect no money. Refunds and seller payouts are not connected.</p>
        : <p className="muted">Online payments, refunds and seller payouts are not available yet.</p>}
    </div>
  );
}
