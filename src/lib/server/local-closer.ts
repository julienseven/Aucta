import "server-only";
import { localServiceRpc } from "./database";
import { localRuntimeEnabled } from "./runtime";

const INTERVAL_MS = 15_000;
const globalCloser = globalThis as typeof globalThis & { auctaLocalCloser?: ReturnType<typeof setInterval> };

function tick() {
  try {
    void localServiceRpc("settle_due", { p_limit: 50 }).catch(() => {
      console.error("local closer failed");
    });
  } catch {
    console.error("local closer failed");
  }
}

export function startLocalCloser(): { started: boolean; reason?: string } {
  if (process.env.AUCTA_LOCAL_CLOSER !== "true") return { started: false, reason: "disabled" };
  if (!localRuntimeEnabled()) return { started: false, reason: "local-runtime" };
  if ((process.env.CRON_SECRET ?? "").length < 32) return { started: false, reason: "cron-secret" };
  if (process.env.NEXT_RUNTIME === "edge") return { started: false, reason: "edge" };
  if (process.env.VITEST) return { started: false, reason: "vitest" };
  if (globalCloser.auctaLocalCloser) return { started: true };
  const timer = setInterval(tick, INTERVAL_MS);
  (timer as { unref?: () => void }).unref?.();
  globalCloser.auctaLocalCloser = timer;
  return { started: true };
}

export function stopLocalCloser() {
  const timer = globalCloser.auctaLocalCloser;
  if (!timer) return;
  clearInterval(timer);
  delete globalCloser.auctaLocalCloser;
}
