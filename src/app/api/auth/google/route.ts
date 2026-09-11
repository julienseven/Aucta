import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin, safeReturnPath } from "@/lib/server/runtime";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route } from "@/lib/server/http";
import { ServiceError } from "@/lib/server/errors";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    enforceRateLimit("google-signin", 30);
    const { next } = await readJson(request, z.object({ next: z.string().max(2048).optional() }).strict());
    const client = await createClient();
    const callback = new URL("/auth/callback", applicationOrigin());
    callback.searchParams.set("next", safeReturnPath(next));
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString(), skipBrowserRedirect: true } });
    if (error || !data.url) throw new ServiceError("Google sign-in is unavailable.", 503);
    return json({ url: data.url });
  });
}
