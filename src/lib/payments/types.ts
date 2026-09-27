import type { orders } from "@/db/schema";

export type GatewayStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded";

export type OrderLike = typeof orders.$inferSelect;

export type CreatePaymentInput = {
  order: OrderLike;
  method: string;
  customer: { name: string; email: string; phone?: string | null };
  returnUrl: string;
};

export type CreatePaymentResult = {
  provider: string;
  providerRef: string;
  status: GatewayStatus;
  method: string;
  redirectUrl?: string | null;
  instructions?: Record<string, unknown>;
  expiresAt?: Date | null;
  raw?: Record<string, unknown>;
};

export type WebhookResult = {
  provider: string;
  providerRef: string;
  orderNumber: string;
  status: GatewayStatus;
  amount: number;
  method?: string;
  raw: Record<string, unknown>;
  signatureVerified: boolean;
};

export interface PaymentProvider {
  readonly key: "midtrans" | "manual";
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  parseWebhook(req: Request): Promise<WebhookResult | null>;
  /** Reconcile a pending attempt by provider order id. */
  getStatus?(providerRef: string): Promise<WebhookResult | null>;
  /** Issue a refund where the gateway supports it. */
  refund?(providerRef: string, amount: number, reason?: string): Promise<boolean>;
}
