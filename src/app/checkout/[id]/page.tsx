import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { lots, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser().catch(() => null);
  if (!user) {
    const { id } = await params;
    redirect(`/sign-in?next=/checkout/${id}`);
  }

  const { id } = await params;
  const rows = await db
    .select({ order: orders, lot: lots })
    .from(orders)
    .innerJoin(lots, eq(orders.lotId, lots.id))
    .where(eq(orders.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const { order, lot } = row;

  if (order.buyerId !== user.id) {
    return (
      <div className="page-enter mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-serif text-2xl">This isn&apos;t your order</h1>
        <Link href="/account?tab=orders" className="btn btn-primary mt-6">
          My orders
        </Link>
      </div>
    );
  }

  if (order.status !== "awaiting_payment") {
    return (
      <div className="page-enter mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success">
          ✓
        </span>
        <h1 className="mt-4 font-serif text-2xl capitalize">
          Order {order.status.replace(/_/g, " ")}
        </h1>
        <p className="mt-2 text-sm text-muted-ink">
          Order {order.number} ·{" "}
          {order.amountDue.toLocaleString("en-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          })}
        </p>
        <Link href="/account?tab=orders" className="btn btn-primary mt-6">
          Track your order
        </Link>
      </div>
    );
  }

  if (process.env.PAYMENT_PROVIDER !== "midtrans" && process.env.PAYMENT_PROVIDER !== "manual") {
    return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="font-serif text-2xl">Checkout is unavailable</h1><p className="mt-3 text-sm text-muted-ink">Payment is not configured yet.</p></div>;
  }

  const plain = JSON.parse(
    JSON.stringify({
      id: order.id,
      number: order.number,
      lotTitle: order.lotTitle || lot.title,
      lotImage: order.lotImage || lot.image,
      lotSlug: lot.slug,
      hammerAmount: Number(order.hammerAmount),
      buyerFeeAmount: Number(order.buyerFeeAmount),
      sellerFeeAmount: Number(order.sellerFeeAmount),
      shippingCost: Number(order.shippingCost),
      amountDue: Number(order.amountDue),
      shippingOption: order.shippingOption,
      shippingAddress: order.shippingAddress,
      status: order.status,
      paymentExpiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    }),
  );

  const gateway = process.env.PAYMENT_PROVIDER === "midtrans" ? "midtrans" : "manual";
  const checkoutSnapshot = order.snapshot as {
    checkout?: { standardShipping?: number };
    money?: { shipping?: number };
  } | null;

  return (
    <div className="page-enter mx-auto w-full max-w-[94rem] px-4 py-10 sm:px-6 lg:px-10">
      <p className="eyebrow">Checkout · {plain.number}</p>
      <h1 className="mt-3 font-serif text-[clamp(1.9rem,4vw,2.8rem)]">
        Complete your <span className="serif-italic font-medium">purchase</span>
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-ink">
        Payment is due by {order.paymentExpiresAt?.toLocaleString("en-ID", { timeZone: "Asia/Jakarta" }) ?? "the order deadline"} Jakarta time, or the lot becomes unsold. The seller has 48 hours after
        settlement to dispatch.
      </p>

      <div className="mt-8">
        <CheckoutForm
          order={plain}
          gateway={gateway}
          shippingQuote={Number(
            checkoutSnapshot?.checkout?.standardShipping ??
            checkoutSnapshot?.money?.shipping ?? lot.shippingCost,
          )}
          lotSlug={lot.slug}
        />
      </div>
    </div>
  );
}
