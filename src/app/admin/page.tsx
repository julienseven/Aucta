import type { Metadata } from 'next';
import { getAdminData } from '@/lib/server/marketplace';
import { loadProtected } from '@/components/pages/protect';
import { AdminDesk } from '@/components/pages/admin-desk';

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

  return <AdminDesk pending={result.data.pending} live={result.data.live} sellers={result.data.sellers} reports={result.data.reports} disputes={result.data.disputes} audit={result.data.audit} />;
}
