'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Order } from '@/lib/domain';
import { Dialog, Feedback, mutate } from '@/components/ui';
import { money } from './helpers';
import styles from './seller-order-flows.module.css';

export function OrderActions({ order, buyer, seller, mockPaymentEnabled }: { order: Order; buyer: boolean; seller: boolean; mockPaymentEnabled: boolean }) {
  const router = useRouter();
  const payKey = useRef(`pay-${order.id}`);
  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [confirmReceipt, setConfirmReceipt] = useState(false);

  async function run(path: string, body: unknown = {}) {
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await mutate(path, body);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (order.status === 'AWAITING_PAYMENT' && buyer) {
    if (!mockPaymentEnabled) {
      return (
        <section className="notice">
          <h2>Payment is not available yet</h2>
          <p>Online checkout is not connected. Payment cannot be recorded here yet; this page cannot extend the payment deadline.</p>
        </section>
      );
    }
    return (
      <section className="notice">
        <h2>Complete payment</h2>
        <p>Binding win. AUCTA records a mock payment of {money(order.total)}. No money is collected.</p>
        <button className="button" type="button" disabled={busy} onClick={() => run(`/api/orders/${order.id}/pay`, { idempotencyKey: payKey.current })}>
          {busy ? 'Recording payment…' : `Pay ${money(order.total)}`}
        </button>
        <Feedback message={message} error={failed} />
      </section>
    );
  }

  if (order.status === 'PAID' && seller) {
    return (
      <section className="notice">
        <h2>Ship this lot</h2>
        <p>Enter the courier the buyer should track. AUCTA does not verify carrier scans.</p>
        <div className="form">
          <div className="field">
            <label className="field-label" htmlFor="order-carrier">Carrier</label>
            <input id="order-carrier" className="input" value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={80} autoComplete="off" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="order-tracking">Tracking number</label>
            <input id="order-tracking" className="input" value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={100} autoComplete="off" />
          </div>
          <button className="button" type="button" disabled={busy || !carrier.trim() || !tracking.trim()} onClick={() => run(`/api/orders/${order.id}/ship`, { carrier, trackingNumber: tracking })}>
            {busy ? 'Saving…' : 'Mark as shipped'}
          </button>
        </div>
        <Feedback message={message} error={failed} />
      </section>
    );
  }

  if (order.status === 'PAID' && buyer) {
    return <p className="notice">Payment is recorded. Waiting on the seller to ship.</p>;
  }

  if (order.status === 'FULFILLMENT' && buyer && !order.receivedAt) {
    return (
      <><section className="notice">
        <h2>Confirm you have it</h2>
        <p>Only confirm once the item matches the listing.</p>
        <button className="button" type="button" disabled={busy} onClick={() => setConfirmReceipt(true)}>
          Confirm received
        </button>
        <Feedback message={message} error={failed} />
      </section>
      <Dialog open={confirmReceipt} onClose={() => setConfirmReceipt(false)} title="Confirm receipt">
        <p>You are confirming that <strong>{order.auction.title}</strong> arrived and matches the listing. This moves the order forward to review.</p>
        <div className="dialog-actions">
          <button className="button button-outline" type="button" disabled={busy} onClick={() => setConfirmReceipt(false)}>Not yet</button>
          <button className="button" type="button" disabled={busy} onClick={() => { setConfirmReceipt(false); void run(`/api/orders/${order.id}/receive`); }}>{busy ? 'Saving…' : 'Yes, I have it'}</button>
        </div>
      </Dialog></>
    );
  }

  if (order.status === 'FULFILLMENT' && buyer && order.receivedAt && !order.review) {
    return (
      <section className="notice">
        <h2>How was the seller?</h2>
        <div className="form">
          <div className="field">
            <label className="field-label" htmlFor="order-rating">Rating</label>
            <select id="order-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="order-review">Review</label>
            <textarea id="order-review" value={text} onChange={(event) => setText(event.target.value)} rows={4} maxLength={2000} />
          </div>
          <button className="button" type="button" disabled={busy} onClick={() => run(`/api/orders/${order.id}/review`, { rating, text })}>
            {busy ? 'Publishing…' : 'Publish review'}
          </button>
        </div>
        <Feedback message={message} error={failed} />
      </section>
    );
  }

  if (order.status === 'FULFILLMENT' && seller && !order.receivedAt) {
    return <p className="notice">The lot is in transit. Waiting for the buyer to confirm receipt.</p>;
  }

  if (order.status === 'FULFILLMENT' && seller && order.receivedAt) {
    return <p className="notice">The buyer confirmed receipt. Waiting on their review to complete the sale.</p>;
  }

  const outcomes: Partial<Record<Order['status'], { title: string; detail: string }>> = {
    PAYMENT_FAILED: { title: 'Payment was not completed', detail: buyer
      ? 'This order is marked payment failed. Payment cannot be retried from this page. You can return to your account to review your other orders.'
      : 'This order is marked payment failed. Do not ship this lot. Relisting and payment recovery are not available from this page.' },
    DISPUTED: { title: 'This order is disputed', detail: 'Payment, shipment and receipt actions are paused while an administrator reviews the issue. Keep your order details and delivery evidence; the recorded outcome appears below.' },
    REFUNDED: { title: 'This order is marked refunded', detail: 'No further payment or fulfillment action is available here. This status alone does not confirm a transfer to a bank account; payment-provider refund details are not available on this page.' },
    CANCELLED: { title: 'This order was cancelled', detail: 'No further payment or shipment action is available. You can still view the recorded order details below.' },
    COMPLETED: { title: buyer ? 'Your order is complete' : 'Your sale is complete', detail: buyer
      ? 'Thank you for collecting with AUCTA. Your order details remain available here whenever you need them.'
      : 'The order is complete. You can return to your seller desk to manage your other lots. Completion does not confirm a seller payout.' },
    AWAITING_PAYMENT: { title: 'Waiting for the buyer', detail: 'The buyer needs to complete payment before you ship. Shipment details can be added after payment is recorded.' },
  };
  const outcome = outcomes[order.status];
  return outcome ? <section className={`notice ${styles.outcome}`} aria-labelledby="order-outcome-title">
    <h2 id="order-outcome-title">{outcome.title}</h2>
    <p>{outcome.detail}</p>
    <Link className="button button-outline" href={seller ? '/selling' : '/account'}>{seller ? 'Back to your seller desk' : 'Back to your account'}</Link>
  </section> : message ? <Feedback message={message} error={failed} /> : null;
}
