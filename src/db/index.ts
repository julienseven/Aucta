import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
const databaseHost = new URL(databaseUrl).hostname;
const supabaseHost = databaseHost.endsWith(".supabase.co") || databaseHost.endsWith(".pooler.supabase.com");
const ssl = supabaseHost ? {
  ca: readFileSync(join(process.cwd(), "certs", "supabase-prod-ca-2021.crt"), "utf8"),
  rejectUnauthorized: true,
} : undefined;

const globalForDb = globalThis as typeof globalThis & {
  __auctaPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__auctaPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl,
    max: process.env.VERCEL ? 1 : 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

globalForDb.__auctaPostgresqlPool = pool;

export const db = drizzle(pool);
