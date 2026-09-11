import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { User } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { LOCAL_COOKIE, LOCAL_IDENTITIES, verifyLocalSession } from "./local-session";
import { localRequestEnabled, supabaseConfigured } from "./runtime";
import { callRpc } from "./repository";
import { ServiceError } from "./errors";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const requestHeaders = await headers();
  let id: string;
  let email: string | undefined;
  let local = false;
  let name = "Collector";
  if (localRequestEnabled(requestHeaders)) {
    const identity = verifyLocalSession((await cookies()).get(LOCAL_COOKIE)?.value);
    if (!identity) return null;
    ({ id, email, name } = LOCAL_IDENTITIES[identity]);
    local = true;
  } else {
    if (!supabaseConfigured()) return null;
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || !user.email_confirmed_at) return null;
    id = user.id;
    email = user.email;
  }
  const dashboard = await callRpc<{ profile?: Record<string, unknown>; seller?: Record<string, unknown> }>("dashboard", {}, id);
  const profile = dashboard.profile;
  if (!profile || profile.suspended === true) return null;
  const role = profile.role === "admin" ? "admin" : profile.role === "seller" || dashboard.seller ? "seller" : "buyer";
  return { id, email, name: String(profile.display_name || profile.display_alias || profile.name || name), role, local, sellerVerified: dashboard.seller?.verification_status === "VERIFIED" || dashboard.seller?.verified === true };
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ServiceError("Sign in to continue.", 401, "UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ServiceError("Administrator access is required.", 403, "FORBIDDEN");
  return user;
}
