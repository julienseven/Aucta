import { requireAdmin } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route, uuid } from "@/lib/server/http";
import { setAccountSuspension, suspensionBody } from "@/lib/server/trust-safety";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireAdmin();
    enforceRateLimit(`admin-suspension:${user.id}`, 20);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Account not found.", 404, "NOT_FOUND");
    const body = await readJson(request, suspensionBody);
    return json(await setAccountSuspension(id, body.suspended, body.reason, user.id));
  });
}

