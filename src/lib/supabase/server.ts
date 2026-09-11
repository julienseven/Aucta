import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ServiceError } from "@/lib/server/errors";
import { supabaseConfigured } from "@/lib/server/runtime";

export async function createClient() {
  if (!supabaseConfigured()) throw new ServiceError("Supabase is not configured. Protected operations are unavailable.", 503, "NOT_CONFIGURED");
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; proxy refreshes the session. */ }
      },
    },
  });
}
