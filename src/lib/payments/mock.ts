import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assertIDR } from "../auction/money";
import { PaymentProviderError, type CreatePaymentInput, type Payment, type PaymentProvider, type Payout, type Refund, type RefundPaymentInput, type SellerPayoutInput, type VerifiedPaymentEvent, type WebhookInput } from "./provider";

type MockEvent = {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  amount: number;
  currency: "IDR";
};

function fail(code: string, message: string): never {
  throw new PaymentProviderError(code, message);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertKey(value: string): void {
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(value)) fail("INVALID_KEY", "An 8–128 character idempotency key is required.");
}

/**
 * Local simulation only: no money moves and no escrow exists. The in-memory store is
 * deliberately isolated; application order/payment truth must be persisted in SQL.
 * A request-aware caller must additionally restrict enabled=true to a loopback host.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private readonly payments = new Map<string, Payment>();
  private readonly orderPayments = new Map<string, string>();
  private readonly payouts = new Map<string, Payout>();
  private readonly orderPayouts = new Map<string, string>();
  private readonly events = new Map<string, { digest: string; paymentId: string }>();
  private readonly requests = new Map<string, { digest: string; result: Payment | Payout | Refund }>();
  private readonly now: () => number;
  private readonly secret: string;

  constructor(options: { enabled: boolean; webhookSecret: string; now?: () => number }) {
    if (!options.enabled || process.env.VERCEL || process.env.NETLIFY) fail("MOCK_DISABLED", "Mock payments are available only in explicit local development mode.");
    if (options.webhookSecret.length < 32) fail("INVALID_SECRET", "A mock webhook secret of at least 32 characters is required.");
    this.secret = options.webhookSecret;
    this.now = options.now ?? Date.now;
  }

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    assertKey(input.idempotencyKey);
    assertIDR(input.amount, "Payment amount", false);
    if (!input.orderId || input.currency !== "IDR" || !Number.isFinite(Date.parse(input.expiresAt))) fail("INVALID_PAYMENT", "A valid order, IDR currency and expiry are required.");
    const retry = this.replay<Payment>("payment", input);
    if (retry) return retry;
    const existingId = this.orderPayments.get(input.orderId);
    if (existingId) {
      const existing = this.payment(existingId);
      if (existing.amount !== input.amount || existing.expiresAt !== input.expiresAt) fail("ORDER_CONFLICT", "The order already has a payment with a different amount or expiry.");
      return this.remember("payment", input, existing);
    }
    if (Date.parse(input.expiresAt) <= this.now()) fail("EXPIRED", "The payment deadline has passed.");
    const payment: Payment = {
      id: `mock_pay_${fingerprint(input.orderId).slice(0, 24)}`, provider: this.name,
      orderId: input.orderId, amount: input.amount, currency: "IDR", status: "PENDING",
      refundedAmount: 0, expiresAt: input.expiresAt, createdAt: this.timestamp(),
    };
    this.payments.set(payment.id, payment);
    this.orderPayments.set(input.orderId, payment.id);
    return this.remember("payment", input, payment);
  }

  async getPaymentStatus(paymentId: string): Promise<Payment> {
    return { ...this.payment(paymentId) };
  }

  async handleWebhook(input: WebhookInput): Promise<VerifiedPaymentEvent> {
    // Authenticate bytes before parsing or reading any payment record.
    this.verifySignature(input);
    let event: MockEvent;
    try {
      const decoded = JSON.parse(input.body) as unknown;
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error();
      event = decoded as MockEvent;
      if (typeof event.id !== "string" || !/^[A-Za-z0-9_.:-]{8,128}$/.test(event.id) || typeof event.paymentId !== "string" || !["payment.succeeded", "payment.failed"].includes(event.type) || event.currency !== "IDR") throw new Error();
      assertIDR(event.amount, "Webhook amount", false);
    } catch {
      fail("INVALID_EVENT", "Invalid mock payment webhook payload.");
    }
    const digest = fingerprint(input.body);
    const prior = this.events.get(event.id);
    if (prior) {
      if (prior.digest !== digest) fail("EVENT_CONFLICT", "Webhook event ID was reused with different content.");
      return { eventId: event.id, payment: { ...this.payment(prior.paymentId) }, duplicate: true };
    }
    const payment = this.payment(event.paymentId);
    if (payment.amount !== event.amount || payment.currency !== event.currency) fail("AMOUNT_MISMATCH", "Webhook amount does not match the immutable payment.");
    const status = event.type === "payment.succeeded" ? "SUCCEEDED" : "FAILED";
    if (payment.status !== "PENDING" && payment.status !== status) fail("INVALID_TRANSITION", "This payment cannot accept that provider event.");
    const updated = { ...payment, status } as Payment;
    this.payments.set(payment.id, updated);
    this.events.set(event.id, { digest, paymentId: payment.id });
    return { eventId: event.id, payment: { ...updated }, duplicate: false };
  }

  async refundPayment(input: RefundPaymentInput): Promise<Refund> {
    assertKey(input.idempotencyKey);
    assertIDR(input.amount, "Refund amount", false);
    if (input.reason.trim().length < 3 || input.reason.length > 1000) fail("INVALID_REASON", "A refund reason is required.");
    const retry = this.replay<Refund>("refund", input);
    if (retry) return retry;
    const payment = this.payment(input.paymentId);
    if (!["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)) fail("NOT_REFUNDABLE", "Only a successful payment can be refunded.");
    if (this.orderPayouts.has(payment.orderId)) fail("PAYOUT_EXISTS", "Refund requires manual provider reconciliation after a payout.");
    if (input.amount > payment.amount - payment.refundedAmount) fail("REFUND_TOO_LARGE", "Refund exceeds the remaining paid amount.");
    const refundedAmount = payment.refundedAmount + input.amount;
    this.payments.set(payment.id, { ...payment, refundedAmount, status: refundedAmount === payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" });
    const refund: Refund = { id: `mock_ref_${fingerprint(input.idempotencyKey).slice(0, 24)}`, paymentId: payment.id, amount: input.amount, status: "SUCCEEDED", createdAt: this.timestamp() };
    return this.remember("refund", input, refund);
  }

  async createSellerPayout(input: SellerPayoutInput): Promise<Payout> {
    assertKey(input.idempotencyKey);
    assertIDR(input.amount, "Payout amount", false);
    assertIDR(input.settlement.sellerProceeds, "Seller proceeds");
    if (input.currency !== "IDR" || !input.sellerId || input.settlement.orderStatus !== "COMPLETED" || input.settlement.disputeOpen || input.amount !== input.settlement.sellerProceeds) fail("PAYOUT_NOT_ELIGIBLE", "A completed, undisputed order and exact seller proceeds are required.");
    const retry = this.replay<Payout>("payout", input);
    if (retry) return retry;
    const payment = this.payment(input.paymentId);
    if (payment.orderId !== input.orderId || payment.status !== "SUCCEEDED" || payment.refundedAmount !== 0 || input.amount > payment.amount) fail("PAYOUT_NOT_ELIGIBLE", "Payment does not cover the eligible seller payout.");
    const existingId = this.orderPayouts.get(input.orderId);
    if (existingId) {
      const existing = this.payouts.get(existingId)!;
      if (existing.sellerId !== input.sellerId || existing.amount !== input.amount) fail("ORDER_CONFLICT", "The order already has a different payout.");
      return this.remember("payout", input, existing);
    }
    const payout: Payout = {
      id: `mock_out_${fingerprint(input.orderId).slice(0, 24)}`, provider: this.name,
      orderId: input.orderId, paymentId: payment.id, sellerId: input.sellerId,
      amount: input.amount, currency: "IDR", status: "SUCCEEDED", createdAt: this.timestamp(),
    };
    this.payouts.set(payout.id, payout);
    this.orderPayouts.set(input.orderId, payout.id);
    return this.remember("payout", input, payout);
  }

  async getPayoutStatus(payoutId: string): Promise<Payout> {
    const payout = this.payouts.get(payoutId);
    if (!payout) fail("PAYOUT_NOT_FOUND", "Payout not found.");
    return { ...payout };
  }

  /** Explicit local simulation entry point. It uses the same signed webhook path as tests. */
  async simulatePayment(paymentId: string, result: "SUCCEEDED" | "FAILED" = "SUCCEEDED"): Promise<VerifiedPaymentEvent> {
    const payment = this.payment(paymentId);
    const body = JSON.stringify({ id: `event_${paymentId}_${result}`, type: result === "SUCCEEDED" ? "payment.succeeded" : "payment.failed", paymentId, amount: payment.amount, currency: "IDR" } satisfies MockEvent);
    const timestamp = Math.floor(this.now() / 1000);
    const signature = createHmac("sha256", this.secret).update(`${timestamp}.${body}`).digest("hex");
    return this.handleWebhook({ body, signature: `t=${timestamp},v1=${signature}` });
  }

  private verifySignature(input: WebhookInput): void {
    if (Buffer.byteLength(input.body, "utf8") > 16_384) fail("INVALID_SIGNATURE", "Webhook payload is too large.");
    const parts = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(input.signature);
    if (!parts) fail("INVALID_SIGNATURE", "Invalid webhook signature.");
    const timestamp = Number(parts[1]);
    if (Math.abs(this.now() / 1000 - timestamp) > 300) fail("INVALID_SIGNATURE", "Webhook signature has expired.");
    const expected = createHmac("sha256", this.secret).update(`${timestamp}.${input.body}`).digest();
    const received = Buffer.from(parts[2], "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) fail("INVALID_SIGNATURE", "Invalid webhook signature.");
  }

  private payment(id: string): Payment {
    const payment = this.payments.get(id);
    if (!payment) fail("PAYMENT_NOT_FOUND", "Payment not found.");
    if (payment.status === "PENDING" && Date.parse(payment.expiresAt) <= this.now()) {
      const expired: Payment = { ...payment, status: "EXPIRED" };
      this.payments.set(id, expired);
      return expired;
    }
    return payment;
  }

  private timestamp(): string { return new Date(this.now()).toISOString(); }

  private replay<T extends Payment | Refund | Payout>(operation: string, input: { idempotencyKey: string }): T | undefined {
    const stored = this.requests.get(`${operation}:${input.idempotencyKey}`);
    if (!stored) return undefined;
    if (stored.digest !== fingerprint(input)) fail("IDEMPOTENCY_CONFLICT", "Idempotency key was already used with different parameters.");
    return { ...stored.result } as T;
  }

  private remember<T extends Payment | Refund | Payout>(operation: string, input: { idempotencyKey: string }, result: T): T {
    this.requests.set(`${operation}:${input.idempotencyKey}`, { digest: fingerprint(input), result: { ...result } });
    return { ...result };
  }
}
