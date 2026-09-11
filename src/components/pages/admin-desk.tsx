'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminData, Auction, Seller } from '@/lib/domain';
import { Feedback, mutate } from '@/components/ui';
import { formatWhen, money, statusLabel } from './helpers';

type Decision = 'approve' | 'reject';

function ModerateControls({ path }: { path: string }) {
  const router = useRouter();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<Decision | null>(null);
  const [message, setMessage] = useState('');
  const ready = reason.trim().length >= 8;
  const blocked = Boolean(busy) || !ready;

  async function decide(decision: Decision) {
    if (blocked) return;
    setBusy(decision);
    setMessage('');
    try {
      await mutate(path, { decision, reason: reason.trim() });
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="moderate-row">
      <div className="field">
        <label className="field-label" htmlFor={reasonId}>Reason</label>
        <textarea className="input" id={reasonId} name="reason" rows={2} minLength={8} maxLength={2000} value={reason} disabled={Boolean(busy)} onChange={event => setReason(event.target.value)} />
      </div>
      <div className="moderate-actions">
        <button className="button" type="button" disabled={blocked} onClick={() => void decide('approve')}>{busy === 'approve' ? 'Working…' : 'Approve'}</button>
        <button className="button button-outline" type="button" disabled={blocked} onClick={() => void decide('reject')}>{busy === 'reject' ? 'Working…' : 'Reject'}</button>
      </div>
      <Feedback message={message} error />
    </div>
  );
}

function PendingListings({ pending }: { pending: Auction[] }) {
  return (
    <section>
      <h2>Pending listings</h2>
      {pending.length === 0 ? <p className="empty-state">No listings waiting for review.</p> : (
        <table className="table">
          <thead><tr><th>Lot</th><th>Seller</th><th>Status</th><th>Start</th></tr></thead>
          <tbody>
            {pending.map(auction => (
              <tr key={auction.listingId || auction.id}>
                <td>
                  <Link href={`/auction/${auction.slug}`}>{auction.title}</Link>
                  <ModerateControls path={`/api/admin/listings/${auction.listingId}`} />
                </td>
                <td>{auction.seller.name}</td>
                <td>{statusLabel(auction.status)}</td>
                <td>{formatWhen(auction.startsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PendingSellers({ sellers }: { sellers: Seller[] }) {
  return (
    <section>
      <h2>Sellers</h2>
      {sellers.length === 0 ? <p className="empty-state">No pending seller records.</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>City</th><th>Verified</th><th>Sales</th></tr></thead>
          <tbody>
            {sellers.map(seller => (
              <tr key={seller.id}>
                <td>
                  {seller.name}
                  <ModerateControls path={`/api/admin/sellers/${seller.id}`} />
                </td>
                <td>{[seller.city, seller.province].filter(Boolean).join(', ')}</td>
                <td>{seller.verified ? 'Verified' : 'Unverified'}</td>
                <td>{seller.completedSales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function AdminDesk({ pending, live, sellers, reports, disputes, audit }: AdminData) {
  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Moderation</p>
        <h1 className="page-title">Admin desk</h1>
        <p className="muted">Decisions are recorded on the server. Listings go live or scheduled only after approval.</p>
      </header>
      <div className="dashboard-grid">
        <div className="stat"><span className="label">Pending listings</span><strong>{pending.length}</strong></div>
        <div className="stat"><span className="label">Live and upcoming</span><strong>{live.length}</strong></div>
        <div className="stat"><span className="label">Seller applications</span><strong>{sellers.length}</strong></div>
        <div className="stat"><span className="label">Open reports</span><strong>{reports.length}</strong></div>
      </div>
      <PendingListings pending={pending} />
      <section>
        <h2>Live and upcoming</h2>
        {live.length === 0 ? <p className="empty-state">No live or scheduled auctions.</p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Status</th><th>Price</th><th>Ends</th></tr></thead>
            <tbody>
              {live.map(auction => (
                <tr key={auction.id}>
                  <td><Link href={`/auction/${auction.slug}`}>{auction.title}</Link></td>
                  <td>{statusLabel(auction.status)}</td>
                  <td>{money(auction.currentPrice)}</td>
                  <td>{formatWhen(auction.endsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <PendingSellers sellers={sellers} />
      <section>
        <h2>Reports</h2>
        {reports.length === 0 ? <p className="empty-state">No reports.</p> : (
          <table className="table">
            <thead><tr><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td>{report.reason}</td>
                  <td>{report.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Disputes</h2>
        {disputes.length === 0 ? <p className="empty-state">No disputes.</p> : (
          <table className="table">
            <thead><tr><th>Reason</th><th>Status</th><th>Order</th></tr></thead>
            <tbody>
              {disputes.map(dispute => (
                <tr key={dispute.id}>
                  <td>{dispute.reason}</td>
                  <td>{dispute.status}</td>
                  <td>{dispute.orderId ? <Link href={`/orders/${dispute.orderId}`}>{dispute.orderId}</Link> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Audit</h2>
        {audit.length === 0 ? <p className="empty-state">No audit rows.</p> : (
          <table className="table">
            <thead><tr><th>Action</th><th>When</th></tr></thead>
            <tbody>
              {audit.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.action}</td>
                  <td>{formatWhen(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
