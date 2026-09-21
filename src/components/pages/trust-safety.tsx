'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog, Feedback, StatusBadge, mutate } from '@/components/ui';
import type { TrustDispute, TrustSafetyData } from '@/lib/trust-safety-types';
import styles from './trust-safety.module.css';

function ReasonAction({ path, body = {}, label, success, description, confirmation }: {
  path: string; body?: Record<string, unknown>; label: string; success: string;
  description: string; confirmation?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const valid = reason.trim().length >= 8 && reason.trim().length <= 2000;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await mutate(path, { ...body, reason: reason.trim() });
      setMessage(success);
      setReason('');
      setConfirming(false);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'The request could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <form className={styles.form} onSubmit={event => {
    event.preventDefault();
    if (!valid || busy) return;
    if (confirmation) setConfirming(true);
    else void submit();
  }} aria-busy={busy}>
    <label className="field-label" htmlFor={id}>Reason</label>
    <p id={`${id}-help`} className={styles.hint}>{description} Use 8–2,000 characters.</p>
    <textarea id={id} value={reason} onChange={event => setReason(event.target.value)} required minLength={8} maxLength={2000} rows={3} aria-describedby={`${id}-help`} disabled={busy} />
    <button className="button button-outline" type="submit" disabled={!valid || busy}>{busy ? 'Saving…' : label}</button>
    {!confirming && <Feedback message={message} error={failed} />}
    <Dialog open={confirming} onClose={() => { if (!busy) setConfirming(false); }} title={label}>
      <p>{confirmation}</p>
      <p className={styles.reason}>{reason}</p>
      <Feedback message={message} error={failed} />
      <div className="dialog-actions">
        <button className="button button-outline" type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        <button className="button" type="button" disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : `Confirm ${label.toLowerCase()}`}</button>
      </div>
    </Dialog>
  </form>;
}

export function ReportListing({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const pathname = usePathname();
  return <details className={styles.panel}>
    <summary>Report this listing</summary>
    <p>Tell us about misleading details, prohibited items or other concerns. A report is reviewed before any moderation action.</p>
    {signedIn ? <ReasonAction path="/api/reports" body={{ listingId }} label="Submit report" success="Your report was recorded for review." description="Describe the concern and the listing details that support it." />
      : <Link className="button button-outline" href={`/sign-in?next=${encodeURIComponent(pathname)}`}>Sign in to report</Link>}
  </details>;
}

export function OrderDispute({ orderId, status, dispute }: { orderId: string; status: string; dispute: TrustDispute | null }) {
  if (dispute) return <section className={styles.panel} aria-label="Order dispute">
    <h2>{dispute.status.toLowerCase() === 'open' ? 'Dispute under review' : 'Dispute record'}</h2>
    <StatusBadge tone={dispute.status.toLowerCase() === 'open' ? 'warning' : 'neutral'}>{dispute.status}</StatusBadge>
    <p className={styles.reason}>{dispute.reason}</p>
    {dispute.resolution_reason ? <><h3>Resolution</h3><p className={styles.reason}>{dispute.resolution_reason}</p></> : <p>Order actions are paused while this dispute is reviewed. Keep delivery records and other relevant evidence.</p>}
  </section>;
  if (status !== 'PAID' && status !== 'FULFILLMENT') return null;
  return <details className={styles.panel}>
    <summary>Need help with this order?</summary>
    <p>Open a dispute if there is a problem with the item or delivery. This pauses order actions until an administrator reviews the issue.</p>
    <ReasonAction path={`/api/orders/${orderId}/dispute`} label="Open dispute" success="Your dispute was recorded. Order actions are paused for review." description="Explain what happened and what would resolve the issue. Do not include passwords or payment details." confirmation="Open this dispute and pause order actions while the issue is reviewed?" />
  </details>;
}

export function TrustSafetyDesk({ data }: { data: TrustSafetyData }) {
  return <section className={styles.desk} aria-labelledby="trust-safety-heading">
    <div><p className="eyebrow">Moderation</p><h2 id="trust-safety-heading">Trust & safety</h2><p>Review the facts and record a reason for every decision.</p></div>
    <section aria-labelledby="listing-reports-heading">
      <h3 id="listing-reports-heading">Listing reports</h3>
      {!data.reports.length && <p className="notice">No listing reports to review.</p>}
      <div className={styles.cards}>{data.reports.map(report => <article className={styles.panel} key={report.id}>
        <h4>{report.listing_title}</h4><StatusBadge>{report.status}</StatusBadge><p className={styles.reason}>{report.reason}</p>
        {['open', 'pending'].includes(report.status.toLowerCase()) && <>
          <p>Recording a review does not remove the listing or suspend its seller.</p>
          <details><summary>Record a decision</summary>
            <ReasonAction path={`/api/admin/reports/${report.id}`} body={{ decision: 'reviewed' }} label="Mark reviewed" success="Report marked reviewed." description="Record your findings and any follow-up needed." />
            <ReasonAction path={`/api/admin/reports/${report.id}`} body={{ decision: 'dismissed' }} label="Dismiss report" success="Report dismissed." description="Explain why this report does not need further action." />
          </details>
        </>}
      </article>)}</div>
    </section>
    <section aria-labelledby="order-disputes-heading">
      <h3 id="order-disputes-heading">Order disputes</h3>
      {!data.disputes.length && <p className="notice">No order disputes to review.</p>}
      <div className={styles.cards}>{data.disputes.map(dispute => <article className={styles.panel} key={dispute.id}>
        <h4>Order {dispute.order_id.slice(0, 8)}</h4><StatusBadge tone={dispute.status.toLowerCase() === 'open' ? 'warning' : 'neutral'}>{dispute.status}</StatusBadge><p className={styles.reason}>{dispute.reason}</p>
        {dispute.status.toLowerCase() === 'open' ? <ReasonAction path={`/api/admin/disputes/${dispute.id}`} label="Resolve dispute" success="Dispute resolved; the order resumed its recorded state." description="Record the agreed outcome and why the order can resume." confirmation={`Resolve this dispute and restore the order to its recorded ${dispute.previous_state ?? 'previous'} state? This does not issue a refund or transfer money.`} />
          : dispute.resolution_reason && <p className={styles.reason}>Resolution: {dispute.resolution_reason}</p>}
      </article>)}</div>
    </section>
    <section aria-labelledby="account-access-heading">
      <h3 id="account-access-heading">Account access</h3>
      <p>Suspensions restrict marketplace activity. Existing orders and auction outcomes remain recorded.</p>
      {!data.accounts.length && <p className="notice">No accounts available.</p>}
      <div className={styles.cards}>{data.accounts.map(account => <article className={styles.panel} key={account.id}>
        <h4>{account.name}</h4><p>{account.role}</p><StatusBadge tone={account.suspended ? 'danger' : 'neutral'}>{account.suspended ? 'Suspended' : 'Active'}</StatusBadge>
        {account.role.toLowerCase() !== 'admin' && <details><summary>{account.suspended ? 'Restore account access' : 'Suspend account'}</summary>
          <ReasonAction path={`/api/admin/accounts/${account.id}/suspension`} body={{ suspended: !account.suspended }} label={account.suspended ? 'Restore access' : 'Suspend account'} success={account.suspended ? 'Account access restored.' : 'Account suspended.'} description="Record the evidence and reason for changing account access." confirmation={account.suspended ? `Restore marketplace access for ${account.name}?` : `Suspend marketplace activity for ${account.name}? Existing bids and order records will remain.`} />
        </details>}
      </article>)}</div>
    </section>
  </section>;
}
