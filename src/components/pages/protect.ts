import { redirect } from 'next/navigation';
import type { User } from '@/lib/domain';
import { ServiceError } from '@/lib/server/errors';
import { getCurrentUser } from '@/lib/server/marketplace';
import { signInPath } from './helpers';

export async function requirePageUser(next: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(next));
  return user;
}

export async function loadProtected<T>(next: string, load: () => Promise<T>): Promise<
  { ok: true; data: T; user: User } | { ok: false; error: string; forbidden: boolean; user: User }
> {
  const user = await requirePageUser(next);
  try {
    return { ok: true, data: await load(), user };
  } catch (error) {
    if (error instanceof ServiceError && error.status === 401) redirect(signInPath(next));
    const forbidden = error instanceof ServiceError && error.status === 403;
    return {
      ok: false,
      forbidden,
      error: error instanceof ServiceError ? error.message : 'This page could not be loaded. Please try again.',
      user,
    };
  }
}

export function publicError(error: unknown, fallback: string): string {
  return error instanceof ServiceError ? error.message : fallback;
}
