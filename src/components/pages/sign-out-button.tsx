'use client';
import { ActionButton } from '@/components/ui';
import { notifySessionChange } from '@/lib/session-events';

export function SignOutButton() {
  return (
    <ActionButton
      path="/api/auth/sign-out"
      label="Sign out"
      doneLabel="Signed out"
      className="button button-outline"
      onDone={() => {
        notifySessionChange();
        window.location.replace('/');
      }}
    />
  );
}
