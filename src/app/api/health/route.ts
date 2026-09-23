import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await pool.query("select 1 from public.lots limit 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
