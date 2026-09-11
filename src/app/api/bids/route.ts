import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { enforceSameOrigin, enforceRateLimit, idr, json, readJson, route, uuid } from "@/lib/server/http";
import { placeBid } from "@/lib/server/mutations";

const bidBody = z.object({ auctionId: uuid, maximum: idr, idempotencyKey: uuid }).strict();

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`bids:${user.id}`, 30);
    const { auctionId, maximum, idempotencyKey } = await readJson(request, bidBody);
    return json(await placeBid(auctionId, maximum, idempotencyKey, user.id));
  });
}
