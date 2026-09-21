import type { Order } from '@/lib/domain';

const STEPS = ['Won', 'Payment', 'Shipped', 'Received', 'Reviewed'] as const;

function currentStep(order: Order): number {
  if (order.review) return 4;
  if (order.receivedAt) return 3;
  if (order.status === 'FULFILLMENT' || order.carrier || order.trackingNumber) return 2;
  if (order.status === 'PAID') return 1;
  return 0;
}

export function OrderProgress({order}:{order:Order}) {
  const current = currentStep(order);
  const ended = ['PAYMENT_FAILED', 'DISPUTED', 'REFUNDED', 'CANCELLED', 'COMPLETED'].includes(order.status);
  return <section className="order-progress" aria-label="Order progress">
    <ol>
      {STEPS.map((step,index) => <li key={step} className={index <= current ? 'is-complete' : !ended && index === current + 1 ? 'is-current' : ''} aria-current={!ended && index === current + 1 ? 'step' : undefined}>
        <span aria-hidden="true">{index <= current ? '✓' : index + 1}</span><strong>{step}</strong>
      </li>)}
    </ol>
    {ended && <p className="muted">The steps above show the milestones recorded for this order. See the order status below for its outcome.</p>}
  </section>;
}
