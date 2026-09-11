import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/server/marketplace';
import { SignInForm } from '@/components/pages/sign-in-form';
import { queryValue, safeNext } from '@/components/pages/helpers';

export const metadata: Metadata = { title: 'Sign in' };

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
          <Link className="button" href={next}>Go to your account</Link>
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
