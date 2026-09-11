import { ServiceError } from "@/lib/server/errors";
import { cookies } from "next/headers";
import { LOCAL_COOKIE } from "@/lib/server/local-session";
import { createClient } from "@/lib/supabase/server";
import { localRequestEnabled, supabaseConfigured } from "@/lib/server/runtime";
import { enforceSameOrigin, json, route } from "@/lib/server/http";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    (await cookies()).delete(LOCAL_COOKIE);
    if (!localRequestEnabled(request.headers) && supabaseConfigured()) {
      const client = await createClient();
      const { error } = await client.auth.signOut();
      if (error) throw new ServiceError("Sign-out could not be completed. Please try again.", 503, "SIGN_OUT_FAILED");
    }
    return json({ signedOut: true });
  });
}
