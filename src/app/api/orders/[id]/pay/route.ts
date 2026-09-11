import { requireUser } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, payBody, readJson, route, uuid } from "@/lib/server/http";
import { payOrder } from "@/lib/server/mutations";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`order-pay:${user.id}`, 20);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Order not found.", 404, "NOT_FOUND");
    const body = await readJson(request, payBody);
    return json(await payOrder(id, body.idempotencyKey, user.id));
  });
}
