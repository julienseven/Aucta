import { requireSeller } from "@/lib/server/auth";
import { enforceSameOrigin, enforceRateLimit, json, listingDraftSchema, readJson, route } from "@/lib/server/http";
import { saveListingDraft } from "@/lib/server/mutations";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireSeller();
    enforceRateLimit(`listings:${user.id}`, 30);
    const payload = await readJson(request, listingDraftSchema);
    return json(await saveListingDraft(null, payload, user.id));
  });
}
