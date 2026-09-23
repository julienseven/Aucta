/* Client-side mirror of the server's safeRedirect, used by forms/router. */
export function safeRedirectClient(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://") || /[\r\n\t]/.test(value)) return fallback;
  return value;
}
