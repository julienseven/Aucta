import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/domain';
import { OrderProgress } from '@/components/pages/order-progress';
import { OrderActions } from '@/components/pages/order-actions';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function order(status: Order['status'], extra: Partial<Order> = {}): Order {
  return { id: 'test-order', status, auction: { title: 'Test lot' }, ...extra } as Order;
}

describe('order outcome presentation', () => {
  it.each(['PAYMENT_FAILED', 'DISPUTED', 'REFUNDED', 'CANCELLED'] as const)('offers no transactional controls for %s', status => {
    const html = renderToStaticMarkup(createElement(OrderActions, { order: order(status), buyer: true, seller: false, mockPaymentEnabled: true }));
    expect(html).toContain('Back to your account');
    expect(html).not.toContain('<button');
  });

  it('does not invent a payment notification promise', () => {
    const html = renderToStaticMarkup(createElement(OrderActions, { order: order('AWAITING_PAYMENT'), buyer: true, seller: false, mockPaymentEnabled: false }));
    expect(html).toContain('Online checkout is not connected');
    expect(html).not.toContain('will notify');
  });

  it('never prepopulates fictional shipment tracking', () => {
    const html = renderToStaticMarkup(createElement(OrderActions, { order: order('PAID'), buyer: false, seller: true, mockPaymentEnabled: false }));
    expect(html).toContain('id="order-tracking"');
    expect(html).not.toContain('value="AUCTA');
    expect(html).not.toContain('value="JNE YES"');
    expect(html).toContain('disabled=""');
  });

  it('does not equate completion with a confirmed payout', () => {
    const html = renderToStaticMarkup(createElement(OrderActions, { order: order('COMPLETED'), buyer: false, seller: true, mockPaymentEnabled: false }));
    expect(html).toContain('Completion does not confirm a seller payout');
  });

  it('uses shipment evidence while a disputed order is paused', () => {
    const html = renderToStaticMarkup(createElement(OrderProgress, { order: order('DISPUTED', { trackingNumber: 'REAL123' }) }));
    expect(html.match(/class="is-complete"/g)).toHaveLength(3);
    expect(html).not.toContain('aria-current');
  });

  it('does not claim a review from completed status alone', () => {
    const html = renderToStaticMarkup(createElement(OrderProgress, { order: order('COMPLETED', { receivedAt: '2026-09-16T00:00:00Z' }) }));
    expect(html.match(/class="is-complete"/g)).toHaveLength(4);
    expect(html).not.toContain('aria-current');
  });
});
