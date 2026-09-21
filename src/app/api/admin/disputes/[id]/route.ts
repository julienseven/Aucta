import { requireAdmin } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route, uuid } from "@/lib/server/http";
import { resolveDispute, disputeBody } from "@/lib/server/trust-safety";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireAdmin();
    enforceRateLimit(`admin-dispute:${user.id}`, 20);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Dispute not found.", 404, "NOT_FOUND");
    const body = await readJson(request, disputeBody);
    return json(await resolveDispute(id, body.reason, user.id));
  });
}

