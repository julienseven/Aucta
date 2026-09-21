'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export function RouteLoading({ title = 'Loading' }: { title?: string }) {
  return (
    <div className="page" role="status" aria-live="polite" aria-busy="true">
      <header className="page-header">
        <p className="eyebrow">AUCTA</p>
        <h1 className="page-title">{title}</h1>
        <p className="muted">Fetching the latest recorded information…</p>
      </header>
    </div>
  );
}

export function RouteError({
  error,
  reset,
  title = 'This page could not be loaded.',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">AUCTA</p>
        <h1 className="page-title">{title}</h1>
        <p>No action was completed. Try loading the page again, or return to the auction floor.</p>
      </header>
      <p className="split">
        <button className="button" type="button" onClick={reset}>Try again</button>
        <Link className="button-outline" href="/auctions">Browse auctions</Link>
      </p>
    </div>
  );
}
