/** Demo facilities are opt-in and cannot run on a hosted deployment. */
export function isLocalDemo() {
  if (process.env.AUCTA_DEMO_MODE !== "true" || process.env.VERCEL || process.env.NODE_ENV === "production") return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "").hostname);
  } catch { return false; }
}
