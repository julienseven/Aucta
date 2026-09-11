import { route } from "@/lib/server/http";
import { readUpload } from "@/lib/server/uploads";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => readUpload((await context.params).id));
}
