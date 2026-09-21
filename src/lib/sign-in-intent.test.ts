import { describe, expect, it } from 'vitest';
import { clearIntent, intentDescription, intentDestination, readIntent } from './sign-in-intent';

describe('sign-in intent recovery', () => {
  it('preserves catalogue filters and fragments through watch recovery and consumption', () => {
    const original = '/auctions?category=watches&sort=price-low&q=Seiko#lots';
    const destination = intentDestination(original, { action: 'watch', auctionId: 'lot-a', watching: true });
    expect(readIntent(destination, 'lot-a')).toEqual({ action: 'watch', auctionId: 'lot-a', watching: true });
    expect(readIntent(destination, 'lot-b')).toBeNull();
    expect(clearIntent(destination)).toBe(original);
    expect(readIntent(clearIntent(destination), 'lot-a')).toBeNull();
  });

  it('preserves explicit removal rather than toggling whichever state is current', () => {
    const destination = intentDestination('/auction/camera', { action: 'watch', auctionId: 'lot-a', watching: false });
    expect(readIntent(destination, 'lot-a')).toEqual({ action: 'watch', auctionId: 'lot-a', watching: false });
    expect(intentDescription(destination)).toContain('removing this auction');
  });

  it('replaces stale intent and requests fresh bid confirmation', () => {
    const destination = intentDestination('/auction/camera?resume=watch&auction=old&watching=true&view=history', { action: 'bid', auctionId: 'new' });
    expect(readIntent(destination, 'new')).toEqual({ action: 'bid', auctionId: 'new' });
    expect(destination).not.toContain('watching');
    expect(clearIntent(destination)).toBe('/auction/camera?view=history');
    expect(intentDescription(destination)).toContain('No bid is placed until you confirm');
  });

  it.each([
    '/auctions?resume=watch&auction=a&watching=yes',
    '/auctions?resume=pay&auction=a',
    '/auctions?resume=bid',
    '/auctions?resume=bid&auction=a&auction=b',
    '/auctions?resume=bid&resume=watch&auction=a',
    '/auctions?resume=watch&auction=a&watching=true&watching=false',
  ])('ignores malformed or ambiguous intent: %s', path => {
    expect(readIntent(path, 'a')).toBeNull();
  });

  it.each(['https://external.example/path', '//external.example/path', '/\\external.example/path'])('keeps unsafe destinations on site: %s', path => {
    const destination = intentDestination(path, { action: 'bid', auctionId: 'a' });
    expect(destination.startsWith('/account?')).toBe(true);
  });
});
