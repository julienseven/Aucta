import "server-only";
import type { PaymentProvider } from "@/lib/payments/types";
import { manualProvider } from "@/lib/payments/manual";
import { midtransProvider } from "@/lib/payments/midtrans";
import { isLocalDemo } from "@/lib/runtime";

export function getPaymentProvider(): PaymentProvider {
  const choice = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (choice === "midtrans" && process.env.MIDTRANS_SERVER_KEY) {
    return midtransProvider;
  }
  if (choice === "manual" && isLocalDemo()) return manualProvider;
  throw new Error("Payments are not available yet.");
}

export { manualProvider, midtransProvider };
export type * from "@/lib/payments/types";
