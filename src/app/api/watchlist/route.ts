import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route, uuid } from "@/lib/server/http";
import { setWatch } from "@/lib/server/mutations";

const watchlistBody = z.object({ auctionId: uuid, watching: z.boolean() }).strict();

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`watchlist:${user.id}`, 40);
    const { auctionId, watching } = await readJson(request, watchlistBody);
    return json(await setWatch(auctionId, watching, user.id));
  });
}
