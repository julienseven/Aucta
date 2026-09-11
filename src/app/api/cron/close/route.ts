import { createHash, timingSafeEqual } from "node:crypto";
import { localRequestEnabled, serviceRoleConfigured } from "@/lib/server/runtime";
import { enforceRateLimit, json, route } from "@/lib/server/http";
import { ServiceError } from "@/lib/server/errors";
import { settleDue } from "@/lib/server/mutations";

function bearerMatches(header: string | null, secret: string) {
  const token = /^Bearer (.+)$/i.exec(header ?? "")?.[1] ?? "";
  const provided = createHash("sha256").update(token).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(provided, expected);
}

export function POST(request: Request) {
  return route(async () => {
    enforceRateLimit("cron-close", 20);
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 32) throw new ServiceError("Auction closing is not configured.", 503, "NOT_CONFIGURED");
    if (!bearerMatches(request.headers.get("authorization"), secret)) throw new ServiceError("Unauthorized.", 401, "UNAUTHENTICATED");
    if (!localRequestEnabled(request.headers) && !serviceRoleConfigured()) {
      throw new ServiceError("Auction closing is unavailable without local mode or a configured service role.", 503, "NOT_CONFIGURED");
    }
    return json(await settleDue(50));
  });
}
