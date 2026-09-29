import "server-only";
import { db } from "@/db";
import { disputes, orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { canTransition } from "@/lib/order-math";

const DISPUTABLE_ORDER_STATUSES = new Set([
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "completed",
]);

export type OpenOrderDisputeInput = {
  orderId: string;
  lotId: string;
  openedById: string;
  openedByAlias: string;
  reason: string;
  evidence: string;
};

export type OpenOrderDisputeResult =
  | { ok: true; id: number }
  | { ok: false; code: "NOT_FOUND" | "LOT_MISMATCH" | "FORBIDDEN" | "STATE" | "EXISTS" };

export async function openOrderDispute(
  input: OpenOrderDisputeInput,
): Promise<OpenOrderDisputeResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1)
      .for("update");
    if (!order) return { ok: false, code: "NOT_FOUND" };
    if (order.lotId !== input.lotId)
      return { ok: false, code: "LOT_MISMATCH" };
    if (order.buyerId !== input.openedById && order.sellerId !== input.openedById)
      return { ok: false, code: "FORBIDDEN" };

    const [existing] = await tx
      .select({ id: disputes.id })
      .from(disputes)
      .where(eq(disputes.orderId, order.id))
      .limit(1);
    if (existing) return { ok: false, code: "EXISTS" };

    if (
      !DISPUTABLE_ORDER_STATUSES.has(order.status) ||
      !canTransition(order.status, "disputed")
    )
      return { ok: false, code: "STATE" };

    const [created] = await tx
      .insert(disputes)
      .values({
        orderId: order.id,
        lotId: order.lotId,
        orderStatusBeforeDispute: order.status,
        openedById: input.openedById,
        openedByAlias: input.openedByAlias,
        reason: input.reason,
        evidence: input.evidence,
      })
      .returning({ id: disputes.id });

    await tx
      .update(orders)
      .set({ status: "disputed" })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)));

    return { ok: true, id: created.id };
  });
}
