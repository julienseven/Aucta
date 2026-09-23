import { createHash } from "node:crypto";
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

function mapStatus(t: string): WebhookResult["status"] {
  switch (t) {
    case "settlement":
    case "capture":
      return "paid";
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
    case "partial_refund":
      return "refunded";
    default:
      return "pending";
  }
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
  return a.equals(b);
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
        start_time: new Date().toISOString().replace("Z", "+00:00"),
        unit: "hours",
        duration: 24,
      },
      page_expiry: {
        duration: 1440,
        unit: "minutes",
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

    return {
      provider: "midtrans",
      providerRef: String(body.transaction_id ?? order_id),
      orderNumber: order_id,
      status: mapStatus(String(body.transaction_status ?? "pending")),
      amount: Math.round(Number.parseFloat(gross_amount.replace(/,/g, "")) || 0),
      method: String(body.payment_type ?? "midtrans"),
      raw: body,
      signatureVerified: true,
    };
  },

  async getStatus(providerRef: string) {
    const cfg = config();
    if (!cfg.serverKey) return null;
    try {
      const res = await fetch(`${cfg.core}/v2/${encodeURIComponent(providerRef)}/status`, {
        headers: { Authorization: authHeader(cfg.serverKey), Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return mapStatus(String(data.transaction_status));
    } catch {
      return null;
    }
  },

  async refund(providerRef: string, amount: number): Promise<boolean> {
    const cfg = config();
    if (!cfg.serverKey) return false;
    try {
      const res = await fetch(`${cfg.core}/v2/refund/${encodeURIComponent(providerRef)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(cfg.serverKey),
        },
        body: JSON.stringify({ amount, reason: "AUCTA dispute resolution" }),
      });
      return res.ok;
    } catch (err) {
      logger.error("midtrans_refund_failed", { error: String(err) });
      return false;
    }
  },
};
