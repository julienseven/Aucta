import { requireAdmin } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, moderateBody, readJson, route, uuid } from "@/lib/server/http";
import { moderateSeller } from "@/lib/server/mutations";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireAdmin();
    enforceRateLimit(`admin-moderate:${user.id}`, 20);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Seller not found.", 404, "NOT_FOUND");
    const body = await readJson(request, moderateBody);
    return json(await moderateSeller(id, body.decision, body.reason, user.id));
  });
}
