import { z } from "zod";
import { requireSeller } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route, uuid } from "@/lib/server/http";
import { submitListing } from "@/lib/server/mutations";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireSeller();
    enforceRateLimit(`listing-submit:${user.id}`, 10);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Listing not found.", 404, "NOT_FOUND");
    if (request.body && request.headers.get("content-type")?.includes("application/json")) {
      await readJson(request, z.object({}).strict());
    }
    return json(await submitListing(id, user.id));
  });
}
