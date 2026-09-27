import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { midtransProvider, verifySignature } from "@/lib/payments/midtrans";

const SERVER_KEY = "SB-Mid-server-test";

function signatureFor(order_id: string, status_code: string, gross_amount: string) {
  return createHash("sha512")
    .update(order_id + status_code + gross_amount + SERVER_KEY)
    .digest("hex");
}

const original = process.env.MIDTRANS_SERVER_KEY;
afterEach(() => {
  process.env.MIDTRANS_SERVER_KEY = original;
});

describe("midtrans webhook signature", () => {
  it("accepts a correctly signed settlement notification", () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    const order_id = "AUCT-20260922-ABC123";
    const status_code = "200";
    const gross_amount = "20045000.00";
    const signature_key = signatureFor(order_id, status_code, gross_amount);
    expect(
      verifySignature({ order_id, status_code, gross_amount, signature_key }),
    ).toBe(true);
  });

  it("rejects a forged signature", () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    expect(
      verifySignature({
        order_id: "AUCT-x",
        status_code: "200",
        gross_amount: "1000",
        signature_key: "deadbeef",
      }),
    ).toBe(false);
  });

  it("rejects when no server key is configured", () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    expect(
      verifySignature({
        order_id: "x",
        status_code: "200",
        gross_amount: "1",
        signature_key: "whatever",
      }),
    ).toBe(false);
  });

  function notification(fields: Record<string, unknown> = {}) {
    const body = {
      order_id: "AUCT-20260922-ABC123",
      transaction_id: "gateway-transaction-1",
      status_code: "200",
      gross_amount: "20045000.00",
      transaction_status: "settlement",
      fraud_status: "accept",
      currency: "IDR",
      ...fields,
    };
    return new Request("http://localhost/api/payments/midtrans/webhook", {
      method: "POST",
      body: JSON.stringify({
        ...body,
        signature_key: signatureFor(body.order_id, body.status_code, body.gross_amount),
      }),
    });
  }

  it("parses a verified whole-IDR settlement with its gateway reference", async () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    const result = await midtransProvider.parseWebhook(notification());
    expect(result).toMatchObject({
      status: "paid",
      amount: 20_045_000,
      providerRef: "gateway-transaction-1",
      orderNumber: "AUCT-20260922-ABC123",
      signatureVerified: true,
    });
  });

  it("holds challenged card captures and rejects fractional IDR", async () => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    expect((await midtransProvider.parseWebhook(notification({
      transaction_status: "capture", fraud_status: "challenge",
    })))?.status).toBe("pending");
    expect(await midtransProvider.parseWebhook(notification({
      gross_amount: "20045000.50",
    }))).toBeNull();
  });
});
