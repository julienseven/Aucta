import "server-only";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { localRuntimeEnabled } from "./runtime";

type LocalDatabase = { db: PGlite; queue: Promise<unknown> };
const globalDatabase = globalThis as typeof globalThis & { auctaDatabase?: Promise<LocalDatabase> };

/** The entire identity + query transaction is queued, never just SET ROLE. */
async function runAsRole<T>(database: LocalDatabase, role: "anon" | "authenticated" | "service_role", userId: string | null,
  operation: (tx: Transaction) => Promise<T>): Promise<T> {
  const run = database.queue.then(() => database.db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    await tx.exec("set local role " + role);
    return operation(tx);
  }));
  database.queue = run.then(() => undefined, () => undefined);
  return run;
}

export function runAsIdentity<T>(database: LocalDatabase, userId: string | null,
  operation: (tx: Transaction) => Promise<T>): Promise<T> {
  return runAsRole(database, userId ? "authenticated" : "anon", userId, operation);
}

/** Test/scheduler-only authority; never accepts a caller-supplied identity. */
export function runAsService<T>(database: LocalDatabase, operation: (tx: Transaction) => Promise<T>): Promise<T> {
  return runAsRole(database, "service_role", null, operation);
}

/** Explicit harness factory; application code uses the guarded singleton below. */
export async function createDatabase(options: { dataDir?: string; seed?: boolean; localMockPayments?: boolean } = {}): Promise<LocalDatabase> {
  const db = new PGlite(options.dataDir ?? "memory://");
  await db.waitReady;
  await db.exec("create table if not exists public.aucta_local_migrations(name text primary key)");
  const applied = await db.query<{ name: string }>("select name from public.aucta_local_migrations");
  const names = new Set(applied.rows.map((row) => row.name));
  if (!names.has("bootstrap")) {
    await db.transaction(async (tx) => {
      await tx.exec(await readFile(path.join(process.cwd(), "supabase/local-bootstrap.sql"), "utf8"));
      await tx.query("insert into public.aucta_local_migrations(name) values ($1)", ["bootstrap"]);
    });
  }
  for (const name of (await readdir(path.join(process.cwd(), "supabase/migrations"))).filter((file) => file.endsWith(".sql")).sort()) {
    if (names.has(name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(await readFile(path.join(process.cwd(), "supabase/migrations", name), "utf8"));
      await tx.query("insert into public.aucta_local_migrations(name) values ($1)", [name]);
    });
  }
  await db.exec("alter table public.aucta_local_migrations enable row level security; revoke all on public.aucta_local_migrations from anon, authenticated; insert into private.settings(key,value) values ('local_mode','true') on conflict(key) do nothing");
  if (options.localMockPayments !== false) {
    await db.exec("grant execute on function public.pay_order(uuid,text) to authenticated");
  }
  if (options.seed && !names.has("fictional-seed-v1")) {
    await db.transaction(async (tx) => {
      await tx.exec(await readFile(path.join(process.cwd(), "supabase/seed.sql"), "utf8"));
      await tx.query("insert into public.aucta_local_migrations(name) values ($1)", ["fictional-seed-v1"]);
    });
  }
  return { db, queue: Promise.resolve() };
}

export async function getLocalDatabase(): Promise<LocalDatabase> {
  // Local production-build verification is allowed on loopback; hosted markers still fail closed.
  if (!localRuntimeEnabled()) {
    throw new Error("Local database requires explicit development mode and cannot run in production.");
  }
  if (!globalDatabase.auctaDatabase) {
    globalDatabase.auctaDatabase = (async () => {
      const localRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), ".local");
      const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.AUCTA_LOCAL_DATA_DIR || path.join(".local", "aucta-db"));
      const relativeDir = path.relative(localRoot, dataDir);
      if (!relativeDir || relativeDir.startsWith("..") || path.isAbsolute(relativeDir)) {
        throw new Error("Local database directory must be a child of the workspace .local directory.");
      }
      await mkdir(dataDir, { recursive: true });
      return createDatabase({ dataDir, seed: true });
    })();
    globalDatabase.auctaDatabase.catch(() => { globalDatabase.auctaDatabase = undefined; });
  }
  return globalDatabase.auctaDatabase;
}

export async function withLocalIdentity<T>(userId: string | null, operation: (tx: Transaction) => Promise<T>): Promise<T> {
  return runAsIdentity(await getLocalDatabase(), userId, operation);
}

export async function localRpc<T = unknown>(userId: string | null, name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!/^[a-z_]+$/.test(name) || !Object.keys(args).every((key) => /^p_[a-z_]+$/.test(key))) throw new Error("Invalid RPC identifier");
  const keys = Object.keys(args);
  return withLocalIdentity(userId, async (tx) => {
    const result = await tx.query<{ result: T }>(`select public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(", ")}) as result`, Object.values(args));
    return result.rows[0].result;
  });
}

/** Narrow local equivalent of the server's authenticated scheduler RPC. */
export async function localServiceRpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (name !== "settle_due" || !Object.keys(args).every((key) => key === "p_limit")) {
    throw new Error("Unsupported service RPC");
  }
  return runAsService(await getLocalDatabase(), async (tx) => {
    const result = await tx.query<{ result: T }>("select public.settle_due(p_limit => $1) as result", [args.p_limit === undefined ? 50 : args.p_limit]);
    return result.rows[0].result;
  });
}
