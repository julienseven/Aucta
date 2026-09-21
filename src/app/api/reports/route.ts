import { requireUser } from "@/lib/server/auth";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route } from "@/lib/server/http";
import { reportListing, reportBody } from "@/lib/server/trust-safety";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`report-listing:${user.id}`, 20);
    const body = await readJson(request, reportBody);
    return json(await reportListing(body.listingId, body.reason, user.id));
  });
}

