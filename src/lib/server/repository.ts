import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { localRequestEnabled, supabaseConfigured } from "./runtime";
import { ServiceError, databaseError } from "./errors";

export async function callRpc<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}, userId: string | null = null): Promise<T> {
  if (localRequestEnabled(await headers())) {
    const { localRpc } = await import("./database");
    try { return await localRpc(userId, name, args) as T; }
    catch (error) { databaseError(error); }
  }
  if (!supabaseConfigured()) throw new ServiceError("The marketplace is not configured. Start explicit local mode or configure a dedicated Supabase project.", 503, "NOT_CONFIGURED");
  const client = await createClient();
  const { data, error } = await client.rpc(name, args);
  if (error) databaseError(error);
  return data as T;
}

/** Only the authenticated closing route may use this privileged RPC seam. */
export async function callServiceRpc<T = Record<string, unknown>>(name: "settle_due", args: Record<string, unknown> = {}): Promise<T> {
  if (localRequestEnabled(await headers())) {
    const { localServiceRpc } = await import("./database");
    try { return await localServiceRpc<T>(name, args); }
    catch (error) { databaseError(error); }
  }
  const client = createServiceClient();
  const { data, error } = await client.rpc(name, args);
  if (error) databaseError(error);
  return data as T;
}
