import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin, safeReturnPath } from "@/lib/server/runtime";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route } from "@/lib/server/http";
import { ServiceError } from "@/lib/server/errors";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    const { email, next } = await readJson(request, z.object({ email: z.string().email().max(254), next: z.string().max(2048).optional() }).strict());
    enforceRateLimit(`email:${email.toLowerCase()}`, 3, 600_000);
    enforceRateLimit("email-total", 50, 600_000);
    const client = await createClient();
    const callback = new URL("/auth/callback", applicationOrigin());
    callback.searchParams.set("next", safeReturnPath(next));
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
    if (error) throw new ServiceError("The sign-in email could not be sent. Please try again later.", 503);
    return json({ message: "Check your email for a secure sign-in link." });
  });
}
