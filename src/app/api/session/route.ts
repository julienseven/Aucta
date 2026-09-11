import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { route } from "@/lib/server/http";

export function GET() {
  return route(async () => NextResponse.json({ user: await getCurrentUser() }, { headers: { "Cache-Control": "private, no-store" } }));
}
