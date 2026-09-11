import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { enforceSameOrigin, enforceRateLimit, json, readJson, route } from "@/lib/server/http";
import { applySeller } from "@/lib/server/mutations";

const sellerBody = z.object({
  shopName: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
}).strict();

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    const user = await requireUser();
    enforceRateLimit(`seller:${user.id}`, 10);
    const { shopName, city, province } = await readJson(request, sellerBody);
    return json(await applySeller(shopName, city, province, user.id));
  });
}
