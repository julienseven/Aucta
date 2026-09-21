import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/server/marketplace';
import { SignInForm } from '@/components/pages/sign-in-form';
import { queryValue, safeNext } from '@/components/pages/helpers';
import { intentDescription } from '@/lib/sign-in-intent';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(queryValue(params.next));
  const user = await getCurrentUser();

  if (user) {
    return (
      <div className="page">
        <div className="sign-in-card">
          <p className="eyebrow">Signed in</p>
          <h1 className="page-title">You are already in.</h1>
          <p>Continue as {user.name}.</p>
          {intentDescription(next) && <p>{intentDescription(next)}</p>}
          <Link className="button" href={next}>{next === '/account' ? 'Go to your account' : 'Continue where you left off'}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">AUCTA</p>
        <h1 className="page-title">Sign in</h1>
        <p className="muted">Use an email link or Google. Local identities appear only in explicit development mode.</p>
      </header>
      <SignInForm local={process.env.AUCTA_LOCAL_MODE === 'true'} next={next} errorCode={queryValue(params.error)} />
    </div>
  );
}
