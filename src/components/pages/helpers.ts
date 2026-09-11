import type { AuctionStatus } from '@/lib/domain';
import { formatIDR } from '@/lib/auction';

export const CATEGORIES = [
  ['watches', 'Watches'],
  ['cameras', 'Cameras'],
  ['cards', 'Cards'],
  ['sneakers', 'Sneakers'],
  ['design', 'Design'],
  ['gaming', 'Gaming'],
  ['electronics', 'Vintage electronics'],
  ['art', 'Art'],
] as const;

export const CONDITIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'For Parts'] as const;

export const SORTS = [
  ['ending-soon', 'Ending soon'],
  ['newest', 'Newest'],
  ['popular', 'Most watched'],
  ['price-low', 'Price, low to high'],
  ['price-high', 'Price, high to low'],
] as const;

const SOLD = new Set<AuctionStatus>(['PAID', 'FULFILLMENT', 'COMPLETED']);

const STATUS_LABEL: Record<AuctionStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  SCHEDULED: 'Upcoming',
  LIVE: 'Live',
  ENDED: 'Closing',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  FULFILLMENT: 'Shipping',
  COMPLETED: 'Completed',
  REJECTED: 'Not approved',
  CANCELLED: 'Cancelled',
  NO_SALE: 'No sale',
  PAYMENT_FAILED: 'Payment missed',
  DISPUTED: 'Disputed',
  REFUNDED: 'Refunded',
};

export function queryValue(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim();
  return trimmed || undefined;
}

export function safeNext(value: unknown, fallback = '/account'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
  return value === '/sign-in' ? fallback : value;
}

export function signInPath(next: string): string {
  return `/sign-in?next=${encodeURIComponent(safeNext(next))}`;
}

export function isSold(status: AuctionStatus): boolean {
  return SOLD.has(status);
}

export function statusLabel(status: AuctionStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function formatWhen(value: string, withTime = true): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'Asia/Jakarta' };
  if (withTime) options.timeStyle = 'short';
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

export function money(amount: number): string {
  try {
    return formatIDR(amount);
  } catch {
    return '—';
  }
}

export function catalogueStatus(value: string | undefined): string | undefined {
  if (!value || value === 'all') return undefined;
  if (value === 'upcoming' || value === 'scheduled') return 'SCHEDULED';
  if (value === 'live') return 'LIVE';
  if (value === 'sold') return 'sold';
  if (value === 'LIVE' || value === 'SCHEDULED' || value === 'sold') return value;
  return undefined;
}

export function catalogueSort(value: string | undefined): string | undefined {
  if (!value || value === 'ending-soon' || value === 'default') return undefined;
  if (value === 'newest' || value === 'popular' || value === 'price-low' || value === 'price-high') return value;
  return undefined;
}
