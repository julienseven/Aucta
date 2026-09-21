import { safeNext } from '@/components/pages/helpers';

type Intent = { auctionId: string; action: 'bid' } | { auctionId: string; action: 'watch'; watching: boolean };
const origin = 'https://aucta.invalid';

export function intentDestination(path: string, intent: Intent): string {
  const url = new URL(safeNext(path), origin);
  url.searchParams.set('resume', intent.action);
  url.searchParams.set('auction', intent.auctionId);
  if (intent.action === 'watch') url.searchParams.set('watching', String(intent.watching));
  else url.searchParams.delete('watching');
  return url.pathname + url.search + url.hash;
}

export function readIntent(path: string, auctionId: string): Intent | null {
  const url = new URL(safeNext(path), origin);
  if (!auctionId || ['resume', 'auction', 'watching'].some(key => url.searchParams.getAll(key).length > 1)) return null;
  if (url.searchParams.get('auction') !== auctionId) return null;
  if (url.searchParams.get('resume') === 'bid') return { action: 'bid', auctionId };
  const watching = url.searchParams.get('watching');
  if (url.searchParams.get('resume') === 'watch' && (watching === 'true' || watching === 'false')) {
    return { action: 'watch', auctionId, watching: watching === 'true' };
  }
  return null;
}

export function clearIntent(path: string): string {
  const url = new URL(safeNext(path), origin);
  for (const key of ['resume', 'auction', 'watching']) url.searchParams.delete(key);
  return url.pathname + url.search + url.hash;
}

export function intentDescription(path: string): string | null {
  const url = new URL(safeNext(path), origin);
  const intent = readIntent(path, url.searchParams.get('auction') ?? '');
  if (!intent?.auctionId) return null;
  return intent.action === 'bid'
    ? 'After sign-in, review the latest price and confirm your maximum. No bid is placed until you confirm.'
    : `After sign-in, confirm ${intent.watching ? 'adding this auction to' : 'removing this auction from'} your watchlist.`;
}
