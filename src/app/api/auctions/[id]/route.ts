import { getAuction } from "@/lib/server/marketplace";
import { ServiceError } from "@/lib/server/errors";
import { json, route, uuid } from "@/lib/server/http";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await context.params;
    if (!uuid.safeParse(id).success) throw new ServiceError("Auction not found.", 404, "NOT_FOUND");
    const detail = await getAuction(id);
    if (!detail) throw new ServiceError("Auction not found.", 404, "NOT_FOUND");
    return json(detail);
  });
}
