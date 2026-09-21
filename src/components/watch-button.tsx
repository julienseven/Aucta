'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from './icons';
import { Dialog, mutate } from './ui';
import { signInPath } from './pages/helpers';
import { clearIntent, intentDestination, readIntent } from '@/lib/sign-in-intent';

function currentPath() {
  return window.location.pathname + window.location.search + window.location.hash;
}

export function WatchButton({ auctionId, watching = false, withLabel = false }: { auctionId: string; watching?: boolean; withLabel?: boolean }) {
  const [active, setActive] = useState(watching);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resume, setResume] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const intent = readIntent(currentPath(), auctionId);
    if (intent?.action !== 'watch') return;
    const timer = window.setTimeout(() => {
      setResume(intent.watching);
      window.history.replaceState(null, '', clearIntent(currentPath()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [auctionId]);

  async function update(desired: boolean) {
    setBusy(true);
    setError('');
    try {
      await mutate('/api/watchlist', { auctionId, watching: desired });
      setActive(desired);
      setResume(null);
      router.refresh();
    } catch (caught) {
      const message = (caught as Error).message;
      if (/sign|auth|session/i.test(message)) {
        router.push(signInPath(intentDestination(currentPath(), { action: 'watch', auctionId, watching: desired })));
      } else setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <span className={withLabel ? 'watch-with-label' : 'card-watch-wrap'}>
      <button type="button" className={withLabel ? 'button button-outline' : 'card-watch'} aria-label={active ? 'Remove from watchlist' : 'Add to watchlist'} aria-pressed={active} disabled={busy} onClick={() => void update(resume ?? !active)}>
        <Heart size={18} fill={active ? 'currentColor' : 'none'} />
        {withLabel && (active ? 'Watching' : 'Watch auction')}
      </button>
      {error && resume === null && <span className="watch-error" role="alert">{error}</span>}
    </span>
    <Dialog open={resume !== null} onClose={() => setResume(null)} title="Continue your watchlist action">
      <p>{resume ? 'Add this auction to your watchlist?' : 'Remove this auction from your watchlist?'}</p>
      <button className="button" type="button" disabled={busy} onClick={() => { if (resume !== null) void update(resume); }}>{busy ? 'Saving…' : resume ? 'Confirm watch' : 'Confirm removal'}</button>
      <button className="button button-outline" type="button" disabled={busy} onClick={() => setResume(null)}>Cancel</button>
      {error && <p role="alert">{error}</p>}
    </Dialog>
    </>
  );
}
