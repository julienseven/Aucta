import { requireUser } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route, shipBody, uuid } from "@/lib/server/http";
import { shipOrder } from "@/lib/server/mutations";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`order-ship:${user.id}`, 20);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Order not found.", 404, "NOT_FOUND");
    const body = await readJson(request, shipBody);
    return json(await shipOrder(id, body.carrier, body.trackingNumber, user.id));
  });
}
