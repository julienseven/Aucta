import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError } from "./errors";
import { applicationOrigin } from "./runtime";

const rateBuckets = new Map<string, { count: number; reset: number }>();

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== applicationOrigin()) throw new ServiceError("This action must be made from the AUCTA website.", 403, "ORIGIN_REJECTED");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ServiceError("Cross-site requests are not allowed.", 403, "ORIGIN_REJECTED");
}

export function enforceRateLimit(key: string, limit = 30, windowMs = 60_000, now = Date.now()) {
  if (rateBuckets.size > 10_000) for (const [entry, bucket] of rateBuckets) if (bucket.reset <= now) rateBuckets.delete(entry);
  const existing = rateBuckets.get(key);
  const bucket = existing && existing.reset > now ? existing : { count: 0, reset: now + windowMs };
  if (bucket.count >= limit) throw new ServiceError("Too many attempts. Please wait a minute and try again.", 429, "RATE_LIMITED");
  bucket.count += 1;
  rateBuckets.set(key, bucket);
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ServiceError("Send an application/json request.", 415);
  if (Number(request.headers.get("content-length") || 0) > 64_000) throw new ServiceError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError("Request body is missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 64_000) { await reader.cancel(); throw new ServiceError("Request is too large.", 413); }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ServiceError("Request body is not valid JSON."); }
  const result = schema.safeParse(body);
  if (!result.success) throw new ServiceError(result.error.issues[0]?.message ?? "Invalid request.");
  return result.data;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof ServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

export async function route(operation: () => Promise<Response>): Promise<Response> {
  try { return await operation(); } catch (error) { return errorResponse(error); }
}

/** PostgreSQL uuid, including the deterministic seed IDs (not RFC version-strict). */
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID");
export const idr = z.number().int().min(1).max(1_000_000_000_000);
export const reason = z.string().trim().min(8, "Please provide at least 8 characters of detail.").max(2000);
export const moderateBody = z.object({
  decision: z.enum(["approve", "reject"]),
  reason,
}).strict();

const listingImage = z.string().max(1000).refine(value => value.startsWith("/images/") || value.startsWith("/api/uploads/"), "Choose an uploaded image.");

export const listingSchema = z.object({
  title: z.string().trim().min(5).max(140),
  category_slug: z.string().regex(/^[a-z0-9-]+$/).max(50),
  description: z.string().trim().min(20).max(10_000),
  condition: z.string().trim().min(2).max(80),
  flaws: z.string().trim().max(5000).default(""),
  provenance: z.string().trim().max(5000).default(""),
  brand: z.string().trim().max(100).default(""),
  attributes: z.record(z.string().max(80), z.string().max(500)).default({}),
  starting_price: idr,
  reserve_price: idr.nullable().optional(),
  increment_override: idr.nullable().optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  shipping_price: z.number().int().min(0).max(10_000_000).default(0),
  images: z.array(listingImage).min(1).max(8),
}).strict().refine(data => new Date(data.ends_at) > new Date(data.starts_at), "End time must be after the start time.");

export const listingDraftSchema = z.object({
  title: z.string().trim().max(140).optional(),
  category_slug: z.string().regex(/^[a-z0-9-]+$/).max(50).optional(),
  description: z.string().trim().max(10_000).optional(),
  condition: z.string().trim().max(80).optional(),
  flaws: z.string().trim().max(5000).optional(),
  provenance: z.string().trim().max(5000).optional(),
  brand: z.string().trim().max(100).optional(),
  attributes: z.record(z.string().max(80), z.string().max(500)).optional(),
  starting_price: idr.optional(),
  reserve_price: idr.nullable().optional(),
  increment_override: idr.nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  shipping_price: z.number().int().min(0).max(10_000_000).optional(),
  images: z.array(listingImage).max(8).optional(),
}).strict().refine(data => !data.starts_at || !data.ends_at || new Date(data.ends_at) > new Date(data.starts_at), "End time must be after the start time.");
