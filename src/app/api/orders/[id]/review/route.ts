import { requireUser } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, readJson, reviewBody, route, uuid } from "@/lib/server/http";
import { reviewOrder } from "@/lib/server/mutations";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`order-review:${user.id}`, 20);
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Order not found.", 404, "NOT_FOUND");
    const body = await readJson(request, reviewBody);
    return json(await reviewOrder(id, body.rating, body.text, user.id));
  });
}
