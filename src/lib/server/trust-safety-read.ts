import 'server-only';
import { requireAdmin, requireUser } from './auth';
import { callRpc } from './repository';
import type { TrustDispute, TrustSafetyData } from '@/lib/trust-safety-types';

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === 'object') : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
function dispute(item: Row): TrustDispute {
  return { id: text(item.id), order_id: text(item.orderId), reason: text(item.reason), status: text(item.status), previous_state: text(item.previousStatus) || null, resolution_reason: text(item.resolutionReason) || null };
}
export async function getTrustSafetyData(): Promise<TrustSafetyData> {
  const user = await requireAdmin();
  const data = await callRpc<Row>('trust_safety_dashboard', {}, user.id);
  return {
    reports: rows(data.reports).map(item => ({ id: text(item.id), listing_id: text(item.listingId), listing_title: text(item.listingTitle), seller_id: text(item.sellerId), reason: text(item.reason), status: text(item.status) })),
    disputes: rows(data.disputes).map(dispute),
    accounts: rows(data.accounts).map(item => ({ id: text(item.userId), name: text(item.displayName), role: text(item.role), suspended: item.suspended === true })),
  };
}
export async function getOrderDispute(orderId: string): Promise<TrustDispute | null> {
  const user = await requireUser();
  const data = await callRpc<Row | null>('order_dispute', { p_order_id: orderId }, user.id);
  return data ? dispute(data) : null;
}
