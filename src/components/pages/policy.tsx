import type { ReactNode } from 'react';

export function PolicyPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <article className="page policy">
      {/* LEGAL_REVIEW_REQUIRED */}
      <header className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
      </header>
      <p className="legal-note">Requires legal review. This is an operational draft for the AUCTA product, not legal advice and not a promise of rights, remedies, insurance or outcomes.</p>
      {children}
    </article>
  );
}
