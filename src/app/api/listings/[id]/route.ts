import { requireSeller } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, listingDraftSchema, readJson, route, uuid } from "@/lib/server/http";
import { getListingEditor } from "@/lib/server/marketplace";
import { saveListingDraft } from "@/lib/server/mutations";

async function listingId(context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuid.safeParse(id).success) throw new ServiceError("Listing not found.", 404, "NOT_FOUND");
  return id;
}

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => json(await getListingEditor(await listingId(context))));
}

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireSeller();
    enforceRateLimit(`listings:${user.id}`, 30);
    const id = await listingId(context);
    const payload = await readJson(request, listingDraftSchema);
    return json(await saveListingDraft(id, payload, user.id));
  });
}
