import { createHash } from "node:crypto";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from "@/lib/payments/types";

/* Fallback provider used when no gateway credentials are configured.
   It generates realistic Indonesian virtual-account / QRIS instructions;
   settlement is confirmed through the desk's verification endpoint
   (mirroring what an actual bank-transfer webhook would do). This is
   explicitly not escrow — it records a pending settlement instruction. */

const BANKS = [
  { code: "BCA", prefix: "7012" },
  { code: "BRI", prefix: "8807" },
  { code: "BNI", prefix: "9880" },
  { code: "MANDIRI", prefix: "8990" },
];

function virtualAccount(orderNumber: string, prefix: string): string {
  const digest = createHash("sha256").update(orderNumber).digest("hex");
  const numeric = digest
    .split("")
    .map((c) => parseInt(c, 16) % 10)
    .join("");
  return `${prefix}${numeric.slice(0, 12 - prefix.length)}`;
}

export const manualProvider: PaymentProvider = {
  key: "manual",

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const method = input.method === "qris" ? "qris" : "bank_transfer";
    const expiresAt =
      input.order.paymentExpiresAt ??
      new Date(Date.now() + 24 * 3_600_000);

    if (method === "qris") {
      return {
        provider: "manual",
        providerRef: input.order.number,
        status: "pending",
        method: "qris",
        expiresAt,
        instructions: {
          kind: "qris",
          qrisString: `00020101021126...AUCTA|${input.order.number}`,
          amount: input.order.amountDue,
          expiresAt: expiresAt.toISOString(),
        },
        raw: { simulated: true },
      };
    }

    const bank = BANKS[input.order.number.charCodeAt(6) % BANKS.length];
    return {
      provider: "manual",
      providerRef: input.order.number,
      status: "pending",
      method: "bank_transfer",
      expiresAt,
      instructions: {
        kind: "va",
        bank: bank.code,
        va: virtualAccount(input.order.number, bank.prefix),
        amount: input.order.amountDue,
        expiresAt: expiresAt.toISOString(),
      },
      raw: { simulated: true },
    };
  },

  // Manual fallback has no push webhook; the verification endpoint stands in
  // for the bank settlement callback.
  async parseWebhook(): Promise<null> {
    return null;
  },
};
