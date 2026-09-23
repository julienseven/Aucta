import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifySignature } from "@/lib/payments/midtrans";

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
});
