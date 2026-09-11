import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingWriter } from '@/components/pages/listing-writer';
import { requirePageUser } from '@/components/pages/protect';
import { ServiceError } from '@/lib/server/errors';
import { callRpc } from '@/lib/server/repository';

export const metadata: Metadata = { title: 'Listing writer' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ListingWriterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requirePageUser(`/selling/${id}`);
  if (user.role === 'buyer') {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">Sell with AUCTA</p>
          <h1 className="page-title">Selling is a separate desk.</h1>
        </header>
        <p>Open a seller desk from the sell page first. Verification is a server decision.</p>
        <p><Link className="button" href="/sell">Open a seller desk</Link></p>
      </div>
    );
  }

  let initial: unknown;
  try {
    initial = await callRpc('listing_editor', { p_listing_id: id }, user.id);
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 403 || error.status === 404)) {
      return (
        <div className="page">
          <header className="page-header"><h1 className="page-title">Listing</h1></header>
          <p className={error.status === 403 ? 'empty-state' : 'error-banner'} role="alert">{error.message}</p>
        </div>
      );
    }
    initial = undefined;
  }

  return (
    <div className="page">
      <ListingWriter listingId={id} initial={initial} />
    </div>
  );
}
