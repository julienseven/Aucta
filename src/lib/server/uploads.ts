import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ServiceError } from "./errors";

const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$/i;
const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function localUploadsDir(): string {
  const localRoot = path.resolve(process.cwd(), ".local");
  const dir = path.resolve(process.cwd(), ".local", "uploads");
  const relative = path.relative(localRoot, dir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ServiceError("Upload directory is not available.", 503, "NOT_CONFIGURED");
  }
  return dir;
}

export function resolveUploadPath(id: string): string {
  if (id.includes("..") || id.includes("/") || id.includes("\\") || path.isAbsolute(id) || !UPLOAD_NAME.test(id)) {
    throw new ServiceError("File not found.", 404, "NOT_FOUND");
  }
  const dir = localUploadsDir();
  const resolved = path.resolve(dir, id);
  const relative = path.relative(dir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new ServiceError("File not found.", 404, "NOT_FOUND");
  return resolved;
}

function extensionFor(bytes: Uint8Array, mime: string): "jpg" | "png" | "webp" | null {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if ((mime === "image/jpeg" || mime === "image/jpg") && jpeg) return "jpg";
  if (mime === "image/png" && png) return "png";
  if (mime === "image/webp" && webp) return "webp";
  return null;
}

export async function storeUpload(request: Request): Promise<{ url: string }> {
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES + 64_000) throw new ServiceError("Request is too large.", 413);
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) throw new ServiceError("Send a multipart file upload.", 415);
  const file = (await request.formData()).get("file");
  if (!(file instanceof Blob) || file.size === 0) throw new ServiceError("Choose an image to upload.");
  if (file.size > MAX_BYTES) throw new ServiceError("Images must be 5 MB or smaller.", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extensionFor(bytes, file.type);
  if (!ext) throw new ServiceError("Upload a JPEG, PNG or WebP image.");
  const id = `${crypto.randomUUID()}.${ext}`;
  const dir = localUploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(resolveUploadPath(id), bytes);
  return { url: `/api/uploads/${id}` };
}

export async function readUpload(id: string): Promise<Response> {
  try {
    const filePath = resolveUploadPath(id);
    const data = await readFile(filePath);
    const ext = id.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("File not found.", 404, "NOT_FOUND");
  }
}
