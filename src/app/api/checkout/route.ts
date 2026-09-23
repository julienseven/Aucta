import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { startCheckout, CheckoutError } from "@/lib/checkout";
import { clientIp, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Sign in required.", code: "AUTH" }, { status: 401 });

  const ip = clientIp(req);
  const rl = rateLimit(`checkout:${user.id}:${ip}`, { limit: 12, windowMs: 60_000 });
  if (!rl.ok)
    return NextResponse.json({ error: "Too many attempts.", code: "RATE" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;

  try {
    const result = await startCheckout({
      buyerId: user.id,
      orderId: String(body?.orderId ?? ""),
      shippingOption: String(body?.shippingOption ?? "standard"),
      addressId: body?.addressId ? String(body.addressId) : null,
      inlineAddress: body?.address ?? null,
      method: String(body?.method ?? "bank_transfer"),
      baseUrl: base,
    });
    return NextResponse.json({
      ok: true,
      redirectUrl: result.payment.redirectUrl ?? null,
      instructions: result.payment.instructions ?? null,
      provider: result.payment.provider,
      attemptId: result.attemptId,
      orderId: result.order.id,
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Checkout could not be started.", code: "GENERIC" },
      { status: 500 },
    );
  }
}
