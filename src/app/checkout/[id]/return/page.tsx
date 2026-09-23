import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Payment in progress" };
export const dynamic = "force-dynamic";

export default async function PaymentReturn({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="grid h-16 w-16 animate-pulse place-items-center rounded-full bg-amber-soft text-amber">
        ⏳
      </span>
      <h1 className="mt-6 font-serif text-3xl">Confirming your payment</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-ink">
        The payment provider is finishing its verification. Your order updates
        automatically once settlement is confirmed — this page can be closed.
      </p>
      <div className="mt-7 flex gap-2">
        <Link href="/account?tab=orders" className="btn btn-primary">
          Track order
        </Link>
        {order && (
          <Link href={`/auctions/${order.lotId}`} className="btn btn-outline">
            View lot
          </Link>
        )}
      </div>
    </div>
  );
}
