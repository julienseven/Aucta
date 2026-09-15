'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/lib/domain';
import { Dialog, Feedback, mutate } from '@/components/ui';
import { money } from './helpers';

export function OrderActions({ order, buyer, seller, mockPaymentEnabled }: { order: Order; buyer: boolean; seller: boolean; mockPaymentEnabled: boolean }) {
  const router = useRouter();
  const payKey = useRef(`pay-${order.id}`);
  const [carrier, setCarrier] = useState('JNE YES');
  const [tracking, setTracking] = useState(`AUCTA${order.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`);
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
          <p>AUCTA will notify you when online payment processing is ready.</p>
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
          <button className="button" type="button" disabled={busy} onClick={() => run(`/api/orders/${order.id}/ship`, { carrier, trackingNumber: tracking })}>
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

  return message ? <Feedback message={message} error={failed} /> : null;
}
