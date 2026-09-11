import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminData } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { formatWhen, money, statusLabel } from '@/components/pages/helpers';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  const result = await loadProtected('/admin', getAdminData);
  if (!result.ok) {
    return (
      <div className="page">
        <header className="page-header"><h1 className="page-title">Admin</h1></header>
        {result.forbidden || result.user.role !== 'admin'
          ? <p className="empty-state">This page is for AUCTA administrators.</p>
          : <p className="error-banner" role="alert">{result.error}</p>}
      </div>
    );
  }

  const { pending, live, sellers, reports, disputes, audit } = result.data;

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Moderation</p>
        <h1 className="page-title">Admin desk</h1>
        <p className="muted">Read-only in this slice. Decisions stay on the server when those APIs exist.</p>
      </header>
      <div className="dashboard-grid">
        <div className="stat"><span className="label">Pending listings</span><strong>{pending.length}</strong></div>
        <div className="stat"><span className="label">Live and upcoming</span><strong>{live.length}</strong></div>
        <div className="stat"><span className="label">Seller applications</span><strong>{sellers.length}</strong></div>
        <div className="stat"><span className="label">Open reports</span><strong>{reports.length}</strong></div>
      </div>
      <section>
        <h2>Pending listings</h2>
        {pending.length === 0 ? <p className="empty-state">No listings waiting for review.</p> : (
          <table className="table">
            <thead><tr><th>Lot</th><th>Seller</th><th>Status</th><th>Start</th></tr></thead>
            <tbody>
              {pending.map(auction => (
                <tr key={auction.id}>
                  <td><Link href={`/auction/${auction.slug}`}>{auction.title}</Link></td>
                  <td>{auction.seller.name}</td>
                  <td>{statusLabel(auction.status)}</td>
                  <td>{formatWhen(auction.startsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
      <section>
        <h2>Sellers</h2>
        {sellers.length === 0 ? <p className="empty-state">No pending seller records.</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>City</th><th>Verified</th><th>Sales</th></tr></thead>
            <tbody>
              {sellers.map(seller => (
                <tr key={seller.id}>
                  <td>{seller.name}</td>
                  <td>{[seller.city, seller.province].filter(Boolean).join(', ')}</td>
                  <td>{seller.verified ? 'Verified' : 'Unverified'}</td>
                  <td>{seller.completedSales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
