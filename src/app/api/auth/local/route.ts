import { cookies } from "next/headers";
import { z } from "zod";
import { requireLocalRequest } from "@/lib/server/runtime";
import { LOCAL_COOKIE, signLocalSession } from "@/lib/server/local-session";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route } from "@/lib/server/http";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    requireLocalRequest(request.headers);
    enforceRateLimit("local-signin", 40);
    const { identity } = await readJson(request, z.object({ identity: z.enum(["buyer", "rival", "seller", "admin"]) }).strict());
    (await cookies()).set(LOCAL_COOKIE, signLocalSession(identity), { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 8 * 60 * 60 });
    return json({ local: true, identity });
  });
}
