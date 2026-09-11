import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ServiceError } from "@/lib/server/errors";
import { serviceRoleConfigured } from "@/lib/server/runtime";

/** Scheduler-only client. User cookies must never replace its service identity. */
export function createServiceClient() {
  if (!serviceRoleConfigured()) throw new ServiceError("Auction closing is not configured.", 503, "NOT_CONFIGURED");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
