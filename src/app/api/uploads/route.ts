import { requireUser } from "@/lib/server/auth";
import { ServiceError } from "@/lib/server/errors";
import { enforceSameOrigin, enforceRateLimit, json, route } from "@/lib/server/http";
import { localRequestEnabled } from "@/lib/server/runtime";
import { storeUpload } from "@/lib/server/uploads";

export function POST(request: Request) {
  return route(async () => {
    enforceSameOrigin(request);
    if (!localRequestEnabled(request.headers)) throw new ServiceError("Image uploads are available only in local development.", 503, "NOT_CONFIGURED");
    const user = await requireUser();
    enforceRateLimit(`uploads:${user.id}`, 20);
    return json(await storeUpload(request));
  });
}
