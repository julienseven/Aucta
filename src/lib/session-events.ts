'use client';

/** Broadcast a cookie session change without storing account data. */
export function notifySessionChange() {
  try {
    localStorage.setItem('aucta:session-change', crypto.randomUUID());
  } catch {
    // When storage is disabled, focusing a tab still refreshes its server session.
  }
}
