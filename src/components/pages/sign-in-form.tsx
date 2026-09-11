'use client';
import { useState } from 'react';
import { Feedback, mutate } from '@/components/ui';
import { safeNext } from './helpers';
import { notifySessionChange } from '@/lib/session-events';

const IDENTITIES = [
  { identity: 'buyer' as const, name: 'Nadia', role: 'Collector', note: 'Watch lots and bid.' },
  { identity: 'rival' as const, name: 'Aditya', role: 'Competing bidder', note: 'A second bidder on the same lots.' },
  { identity: 'seller' as const, name: 'Raka Studio', role: 'Seller', note: 'Seller desk and sold lots.' },
  { identity: 'admin' as const, name: 'Admin', role: 'Administrator', note: 'Approve or reject listings and sellers.' },
];

function httpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function SignInForm({ local, next, errorCode }: { local: boolean; next: string; errorCode?: string }) {
  const destination = safeNext(next);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState(errorCode ? 'Sign-in could not be completed. Please try again.' : '');
  const [failed, setFailed] = useState(Boolean(errorCode));

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage('');
    setFailed(false);
    try {
      await action();
    } catch (error) {
      setFailed(true);
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sign-in-card">
      {local && (
        <>
          <p className="eyebrow">Local development</p>
          <p className="notice">Fictional identities for this computer. They are not production accounts.</p>
          <div className="identity-grid">
            {IDENTITIES.map(item => (
              <button
                key={item.identity}
                type="button"
                className="identity-card"
                disabled={busy !== null}
                onClick={() => run(item.identity, async () => {
                  await mutate('/api/auth/local', { identity: item.identity });
                  notifySessionChange();
                  // A full navigation starts a new server request with the new cookie,
                  // avoiding anonymous prefetched RSC responses after authentication.
                  window.location.assign(destination);
                })}
              >
                <span className="eyebrow">{item.role}</span>
                <strong>{item.name}</strong>
                <span className="muted">{item.note}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <form
        className="form"
        onSubmit={event => {
          event.preventDefault();
          void run('email', async () => {
            const result = await mutate<{ message?: string }>('/api/auth/email', { email, next: destination });
            setMessage(result.message ?? 'Check your email for a secure sign-in link.');
          });
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="email">Email</label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <button className="button" type="submit" disabled={busy !== null}>{busy === 'email' ? 'Working…' : 'Email me a sign-in link'}</button>
      </form>
      <button
        className="button button-outline"
        type="button"
        disabled={busy !== null}
        onClick={() => run('google', async () => {
          const result = await mutate<{ url?: string }>('/api/auth/google', { next: destination });
          if (!result.url || !httpUrl(result.url)) throw new Error('Google sign-in is unavailable.');
          window.location.assign(result.url);
        })}
      >
        {busy === 'google' ? 'Working…' : 'Continue with Google'}
      </button>
      <Feedback message={message} error={failed} />
    </div>
  );
}
