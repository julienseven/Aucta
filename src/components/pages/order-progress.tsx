import type { Order } from '@/lib/domain';

const STEPS = ['Won', 'Payment', 'Shipped', 'Received', 'Reviewed'] as const;

function currentStep(order: Order): number {
  if (order.status === 'COMPLETED' || order.review) return 4;
  if (order.receivedAt) return 3;
  if (order.status === 'FULFILLMENT') return 2;
  if (order.status === 'PAID') return 1;
  return 0;
}

export function OrderProgress({order}:{order:Order}) {
  const current = currentStep(order);
  return <nav className="order-progress" aria-label="Order progress">
    <ol>
      {STEPS.map((step,index) => <li key={step} className={index < current ? 'is-complete' : index === current ? 'is-current' : ''} aria-current={index === current ? 'step' : undefined}>
        <span aria-hidden="true">{index < current ? '✓' : index + 1}</span><strong>{step}</strong>
      </li>)}
    </ol>
  </nav>;
}
