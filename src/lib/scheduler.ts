import "server-only";
import { logger } from "@/lib/logger";
import {
  activateDueStarts,
  processDueCloses,
  sendEndingSoon,
  sendShipReminders,
} from "@/lib/close";
import { expireUnpaidOrders } from "@/lib/payments/confirm";
import { reconcilePendingPayments, autoCompleteDelivered } from "@/lib/payments/reconcile";

let running = false;
let lastEndingSoon = 0;
let lastShipReminder = 0;
let lastReconcile = 0;
let lastAutoComplete = 0;

const TICK_MS = 20_000;

export async function runTick() {
  if (running) return;
  running = true;
  try {
    await activateDueStarts().catch((e) => logger.error("activate_failed", { e: String(e) }));
    await processDueCloses().catch((e) => logger.error("close_failed", { e: String(e) }));
    await expireUnpaidOrders().catch((e) => logger.error("expire_failed", { e: String(e) }));

    const now = Date.now();
    if (now - lastEndingSoon > 15 * 60_000) {
      lastEndingSoon = now;
      await sendEndingSoon().catch(() => null);
    }
    if (now - lastShipReminder > 6 * 3_600_000) {
      lastShipReminder = now;
      await sendShipReminders().catch(() => null);
    }
    if (now - lastReconcile > 5 * 60_000) {
      lastReconcile = now;
      await reconcilePendingPayments().catch(() => null);
    }
    if (now - lastAutoComplete > 12 * 3_600_000) {
      lastAutoComplete = now;
      await autoCompleteDelivered().catch(() => null);
    }
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (process.env.DISABLE_SCHEDULER === "true") return;
  setTimeout(() => void runTick(), 8_000);
  const timer = setInterval(() => void runTick(), TICK_MS);
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
  logger.info("scheduler_started", { tickMs: TICK_MS });
}
