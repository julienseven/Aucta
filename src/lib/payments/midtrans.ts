import { createHash, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/logger";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  WebhookResult,
} from "@/lib/payments/types";

/* Midtrans (Snap Core + HTTP notification) adapter.
   Docs: https://docs.midtrans.com/docs/snap-snap-integration-guide
   Env:
     MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=true|false
   The server key is server-only; signatures are verified on every webhook. */

function config() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const snap = isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
  const core = isProduction
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
  return {
    serverKey: process.env.MIDTRANS_SERVER_KEY ?? "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
    snap,
    core,
    isProduction,
  };
}

function authHeader(serverKey: string): string {
  return "Basic " + Buffer.from(`${serverKey}:`).toString("base64");
}

function mapStatus(t: string, fraud?: string): WebhookResult["status"] {
  switch (t) {
    case "settlement":
      return !fraud || fraud === "accept" ? "paid" : "pending";
    case "capture":
      return fraud === "accept" ? "paid" : "pending";
    case "pending":
      return "pending";
    case "deny":
    case "failure":
      return "failed";
    case "expire":
      return "expired";
    case "cancel":
      return "cancelled";
    case "refund":
      return "refunded";
    default:
      return "pending";
  }
}

function parseAmount(value: unknown): number | null {
  const text = String(value ?? "");
  if (!/^\d+(?:\.00)?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function parseStatus(body: Record<string, unknown>, signatureVerified: boolean): WebhookResult | null {
  const orderNumber = String(body.order_id ?? "");
  const amount = parseAmount(body.gross_amount);
  if (!orderNumber || amount === null ||
      (body.currency && body.currency !== "IDR")) return null;
  const status = mapStatus(String(body.transaction_status ?? ""), String(body.fraud_status ?? ""));
  if (status === "paid" && String(body.status_code) !== "200") return null;
  return {
    provider: "midtrans",
    providerRef: String(body.transaction_id ?? orderNumber),
    orderNumber,
    status,
    amount,
    method: String(body.payment_type ?? "midtrans"),
    raw: body,
    signatureVerified,
  };
}

/* Midtrans signature: sha512(order_id + status_code + gross_amount + serverKey) */
export function verifySignature(params: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
}): boolean {
  const cfg = config();
  if (!params.signature_key || !cfg.serverKey) return false;
  const expected = createHash("sha512")
    .update(
      params.order_id +
        params.status_code +
        params.gross_amount +
        cfg.serverKey,
    )
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature_key);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const midtransProvider: PaymentProvider = {
  key: "midtrans",

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const cfg = config();
    if (!cfg.serverKey) throw new Error("MIDTRANS_SERVER_KEY not configured");

    const body = {
      transaction_details: {
        order_id: input.order.number,
        gross_amount: input.order.amountDue,
      },
      customer_details: {
        first_name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone ?? undefined,
      },
      callbacks: {
        finish: `${input.returnUrl}?order=${encodeURIComponent(input.order.number)}`,
      },
      expiry: {
        unit: "minutes",
        duration: Math.max(1, Math.floor(((input.order.paymentExpiresAt?.getTime() ?? 0) - Date.now()) / 60_000)),
      },
    };

    const res = await fetch(cfg.snap, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader(cfg.serverKey),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      logger.error("midtrans_create_failed", { status: res.status, error: data?.error_messages });
      throw new Error("Payment provider declined to create a transaction.");
    }

    return {
      provider: "midtrans",
      providerRef: input.order.number,
      status: "pending",
      method: input.method,
      redirectUrl: data.redirect_url,
      expiresAt: input.order.paymentExpiresAt,
      raw: { token: data.token },
    };
  },

  async parseWebhook(req: Request): Promise<WebhookResult | null> {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return null;
    }
    const order_id = String(body.order_id ?? "");
    const status_code = String(body.status_code ?? "");
    const gross_amount = String(body.gross_amount ?? "");
    const signature_key = String(body.signature_key ?? "");
    if (!order_id) return null;

    const signatureVerified = verifySignature({
      order_id,
      status_code,
      gross_amount,
      signature_key,
    });
    if (!signatureVerified) {
      logger.warn("midtrans_bad_signature", { order_id });
      return null;
    }

    return parseStatus(body, true);
  },

  async getStatus(providerRef: string) {
    const cfg = config();
    if (!cfg.serverKey) return null;
    try {
      const res = await fetch(`${cfg.core}/v2/${encodeURIComponent(providerRef)}/status`, {
        headers: { Authorization: authHeader(cfg.serverKey), Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      if (String(data.order_id ?? "") !== providerRef) return null;
      const verified = verifySignature({
        order_id: String(data.order_id ?? ""),
        status_code: String(data.status_code ?? ""),
        gross_amount: String(data.gross_amount ?? ""),
        signature_key: String(data.signature_key ?? ""),
      });
      return verified ? parseStatus(data, true) : null;
    } catch {
      return null;
    }
  },

  async refund(providerRef: string, amount: number): Promise<boolean> {
    const cfg = config();
    if (!cfg.serverKey || !Number.isSafeInteger(amount) || amount <= 0) return false;
    try {
      const res = await fetch(`${cfg.core}/v2/${encodeURIComponent(providerRef)}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(cfg.serverKey),
        },
        body: JSON.stringify({
          refund_key: `AUCTA-REFUND-${providerRef.replace(/[^A-Za-z0-9_-]/g, "-")}`,
          amount,
          reason: "AUCTA dispute resolution",
        }),
      });
      const result = await res.json().catch(() => ({}));
      return res.ok && String(result.status_code ?? "") === "200";
    } catch (err) {
      logger.error("midtrans_refund_failed", { error: String(err) });
      return false;
    }
  },
};
