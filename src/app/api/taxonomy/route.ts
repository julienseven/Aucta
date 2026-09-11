import { json, route } from "@/lib/server/http";
import { getTaxonomy } from "@/lib/server/marketplace";

export function GET() {
  return route(async () => json({ categories: await getTaxonomy() }));
}
