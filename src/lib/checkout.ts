import "server-only";
import { db } from "@/db";
import {
  addresses,
  orders,
  paymentAttempts,
  users,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  computeOrderTotals,
  shippingCostFor,
  shippingOptions,
} from "@/lib/order-math";
import { getPaymentProvider } from "@/lib/payments";
import type { CreatePaymentResult } from "@/lib/payments/types";

type OrderRow = typeof orders.$inferSelect;

export class CheckoutError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type InlineAddress = {
  recipientName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
};

export async function startCheckout(input: {
  buyerId: string;
  orderId: string;
  shippingOption: string;
  addressId?: string | null;
  inlineAddress?: InlineAddress | null;
  method?: string;
  baseUrl: string;
}): Promise<{
  order: OrderRow;
  payment: CreatePaymentResult;
  attemptId: string;
}> {
  return db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    const order = orderRows[0];
    if (!order) throw new CheckoutError(404, "NOT_FOUND", "Order not found.");
    if (order.buyerId !== input.buyerId)
      throw new CheckoutError(403, "FORBIDDEN", "This is not your order.");
    if (order.status !== "awaiting_payment")
      throw new CheckoutError(409, "STATE", "This order is no longer awaiting payment.");
    if (!order.paymentExpiresAt || order.paymentExpiresAt.getTime() <= Date.now() + 60_000)
      throw new CheckoutError(409, "EXPIRED", "The payment window has closed.");

    /* Resolve the shipping address (saved or inline) into the immutable snapshot. */
    let address: Record<string, unknown> | null = null;
    if (input.addressId) {
      const rows = await tx
        .select()
        .from(addresses)
        .where(
          and(
            eq(addresses.id, input.addressId),
            eq(addresses.userId, input.buyerId),
          ),
        )
        .limit(1);
      if (!rows[0]) throw new CheckoutError(400, "ADDRESS", "Address not found.");
      const a = rows[0];
      address = {
        recipientName: a.recipientName,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
      };
    } else if (input.inlineAddress && input.shippingOption !== "pickup") {
      const a = input.inlineAddress;
      const required = ["recipientName", "phone", "line1", "city", "province"] as const;
      for (const k of required) {
        if (!String(a[k] ?? "").trim())
          throw new CheckoutError(400, "ADDRESS", `Shipping address needs ${k}.`);
      }
      address = {
        recipientName: a.recipientName,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2 ?? "",
        city: a.city,
        province: a.province,
        postalCode: a.postalCode ?? "",
      };
    } else if (input.shippingOption === "pickup") {
      address = { kind: "pickup" };
    } else {
      throw new CheckoutError(400, "ADDRESS", "Choose a delivery address.");
    }

    // Standard quote was snapshotted at close; recompute from that baseline.
    const snap = (order.snapshot ?? {}) as {
      money?: { shipping?: number };
      checkout?: { standardShipping?: number };
    };
    const standardQuote =
      input.shippingOption === "pickup"
        ? 0
        : Number(snap.checkout?.standardShipping ?? snap.money?.shipping ?? order.shippingCost);
    const shipping =
      input.shippingOption === "standard"
        ? standardQuote
        : shippingCostFor(standardQuote, input.shippingOption);
    const totals = computeOrderTotals({
      hammer: Number(order.hammerAmount),
      shipping,
    });
    if (!Number.isSafeInteger(totals.amountDue) || totals.amountDue <= 0)
      throw new CheckoutError(400, "AMOUNT", "Invalid payment amount.");
    const option = shippingOptions(standardQuote).find(
      (o) => o.id === input.shippingOption,
    );
    if (!option)
      throw new CheckoutError(400, "SHIPPING", "Choose a valid shipping option.");

    const provider = getPaymentProvider();
    const [existing] = await tx.select().from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, order.id))
      .orderBy(desc(paymentAttempts.createdAt)).limit(1);
    if (existing) {
      if (existing.provider !== provider.key || existing.status !== "pending" ||
          (!existing.redirectUrl && !Object.keys(existing.instructions ?? {}).length))
        throw new CheckoutError(409, "PAYMENT", "Payment is already in progress. Contact support if it cannot be completed.");
      if (existing.amount !== totals.amountDue || order.shippingOption !== input.shippingOption ||
        JSON.stringify(order.shippingAddress) !== JSON.stringify(address))
        throw new CheckoutError(409, "PAYMENT", "Payment has started with different checkout details.");
      return {
        order,
        payment: {
          provider: existing.provider, providerRef: existing.providerRef ?? order.number,
          status: "pending" as const, method: existing.method,
          redirectUrl: existing.redirectUrl, instructions: existing.instructions ?? undefined,
          expiresAt: existing.expiresAt,
        },
        attemptId: existing.id,
      };
    }

    await tx
      .update(orders)
      .set({
        shippingOption: input.shippingOption,
        shippingLabel: option?.label ?? null,
        shippingCost: shipping,
        shippingAddress: address,
        buyerFeeAmount: totals.buyerFee,
        sellerFeeAmount: order.sellerFeeAmount || totals.sellerFee,
        amountDue: totals.amountDue,
      })
      .where(eq(orders.id, order.id));

    const fresh = (
      await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1)
    )[0];

    const buyer = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.buyerId))
      .limit(1);
    const buyerRow = buyer[0];
    const payment = await provider.createPayment({
      order: fresh,
      method: input.method ?? "bank_transfer",
      customer: {
        name: buyerRow?.displayName ?? buyerRow?.alias ?? "AUCTA buyer",
        email: buyerRow?.email ?? "buyer@aucta.local",
        phone: (address?.phone as string | undefined) ?? null,
      },
      returnUrl: `${input.baseUrl}/checkout/${order.id}/return`,
    });

    const [attempt] = await tx
      .insert(paymentAttempts)
      .values({
        orderId: order.id,
        provider: payment.provider,
        providerRef: payment.providerRef,
        method: payment.method,
        amount: totals.amountDue,
        status: payment.status === "paid" ? "paid" : "pending",
        redirectUrl: payment.redirectUrl ?? null,
        instructions: payment.instructions ?? {},
        raw: payment.raw ?? {},
        expiresAt: payment.expiresAt ?? fresh.paymentExpiresAt,
        idempotencyKey: `${order.number}:${payment.provider}`,
      })
      .returning();

    // Refresh snapshot with final checkout money + address.
    const snapshot = {
      ...((fresh.snapshot as Record<string, unknown>) ?? {}),
      checkout: {
        shippingOption: input.shippingOption,
        shippingLabel: option?.label,
        standardShipping: Number(snap.checkout?.standardShipping ?? snap.money?.shipping ?? order.shippingCost),
        address,
        finalizedAt: new Date().toISOString(),
      },
      money: {
        ...((fresh.snapshot as { money?: Record<string, unknown> }).money ?? {}),
        shipping: totals.shipping,
        amountDue: totals.amountDue,
      },
    };
    await tx.update(orders).set({ snapshot }).where(eq(orders.id, order.id));

    return { order: fresh, payment, attemptId: attempt.id };
  });
}
