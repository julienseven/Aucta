export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type PayoutStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export interface Payment {
  id: string;
  provider: string;
  orderId: string;
  amount: number;
  currency: "IDR";
  status: PaymentStatus;
  refundedAmount: number;
  expiresAt: string;
  createdAt: string;
}

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: "IDR";
  expiresAt: string;
  idempotencyKey: string;
}

export interface RefundPaymentInput {
  paymentId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  status: "SUCCEEDED";
  createdAt: string;
}

/** This evidence is supplied by a trusted server after locking and checking its database order. */
export interface SellerPayoutInput {
  orderId: string;
  paymentId: string;
  sellerId: string;
  amount: number;
  currency: "IDR";
  idempotencyKey: string;
  settlement: { orderStatus: string; disputeOpen: boolean; sellerProceeds: number };
}

export interface Payout {
  id: string;
  provider: string;
  orderId: string;
  paymentId: string;
  sellerId: string;
  amount: number;
  currency: "IDR";
  status: PayoutStatus;
  createdAt: string;
}

export interface WebhookInput {
  /** Exact unparsed HTTP request body, retained for signature verification. */
  body: string;
  signature: string;
}

export interface VerifiedPaymentEvent {
  eventId: string;
  payment: Payment;
  duplicate: boolean;
}

/** Provider adapters do not authorize users. The caller owns authenticated SQL transitions. */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<Payment>;
  getPaymentStatus(paymentId: string): Promise<Payment>;
  handleWebhook(input: WebhookInput): Promise<VerifiedPaymentEvent>;
  refundPayment(input: RefundPaymentInput): Promise<Refund>;
  createSellerPayout(input: SellerPayoutInput): Promise<Payout>;
  getPayoutStatus(payoutId: string): Promise<Payout>;
}

export class PaymentProviderError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
