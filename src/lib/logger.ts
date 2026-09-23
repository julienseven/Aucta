/* Minimal structured logger (JSON lines) for observability.
   PII is never logged; keep payloads to ids, statuses and counts. */

type Level = "info" | "warn" | "error";

function write(level: Level, event: string, meta?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ?? {}),
  };
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => write("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => write("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => write("error", event, meta),
};
